import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { env } from "../../core/config/env";
import { DEFAULT_TIMEZONE } from "../../core/utils/timezone.utils";
import { RecurrenceService } from "./recurrence.service";

type DueUser = {
  userId: string;
  timezone: string;
};

type JobRunStats = {
  usersProcessed: number;
  usersFailed: number;
  createdOccurrences: number;
  skippedOccurrences: number;
  createdTransactions: number;
  createdTransfers: number;
  finalizedRecurrences: number;
  failedRecurrences: number;
};

type RecurrenceDailyJobOptions = {
  enabled: boolean;
  targetTime: string;
  pollIntervalMs: number;
  lockTtlMs: number;
  timeoutMs: number;
  retryDelaysMs: number[];
  batchSize: number;
  maxAttempts: number;
  maxBatchesPerUserRun: number;
};

const JOB_KEY = "recurrences_daily_materialization";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRetryDelays(delays: number[], maxAttempts: number) {
  const retries = Math.max(0, maxAttempts - 1);
  if (retries === 0) return [];
  if (delays.length === 0) {
    return Array.from({ length: retries }, () => 0);
  }
  if (delays.length >= retries) {
    return delays.slice(0, retries);
  }
  const fallback = delays[delays.length - 1] ?? 0;
  return [...delays, ...Array.from({ length: retries - delays.length }, () => fallback)];
}

export class RecurrenceDailyJob {
  private readonly recurrenceService: RecurrenceService;
  private readonly options: RecurrenceDailyJobOptions;
  private readonly ownerId = randomUUID();
  private timer: NodeJS.Timeout | null = null;
  private tickRunning = false;

  constructor(
    private app: FastifyInstance,
    options?: Partial<RecurrenceDailyJobOptions>,
  ) {
    this.recurrenceService = new RecurrenceService(app);
    const maxAttempts = options?.maxAttempts ?? env.RECURRENCES_JOB_MAX_ATTEMPTS;
    const retryDelaysMs = normalizeRetryDelays(
      options?.retryDelaysMs ?? env.RECURRENCES_JOB_RETRY_DELAYS_MS,
      maxAttempts,
    );

    this.options = {
      enabled: options?.enabled ?? env.RECURRENCES_JOB_ENABLED,
      targetTime: options?.targetTime ?? env.RECURRENCES_JOB_TARGET_TIME,
      pollIntervalMs: options?.pollIntervalMs ?? env.RECURRENCES_JOB_POLL_INTERVAL_MS,
      lockTtlMs: options?.lockTtlMs ?? env.RECURRENCES_JOB_LOCK_TTL_MS,
      timeoutMs: options?.timeoutMs ?? env.RECURRENCES_JOB_TIMEOUT_MS,
      retryDelaysMs,
      batchSize: options?.batchSize ?? env.RECURRENCES_JOB_BATCH_SIZE,
      maxAttempts,
      maxBatchesPerUserRun:
        options?.maxBatchesPerUserRun ?? env.RECURRENCES_JOB_MAX_BATCHES_PER_USER_RUN,
    };
  }

  start() {
    if (!this.options.enabled) {
      this.app.log.info({ event: "recurrences.job.disabled" }, "Recurrence daily job disabled.");
      return;
    }
    if (this.timer) {
      return;
    }

    this.app.log.info(
      {
        event: "recurrences.job.started",
        jobKey: JOB_KEY,
        targetTime: this.options.targetTime,
        pollIntervalMs: this.options.pollIntervalMs,
        lockTtlMs: this.options.lockTtlMs,
        timeoutMs: this.options.timeoutMs,
        retryDelaysMs: this.options.retryDelaysMs,
        batchSize: this.options.batchSize,
        maxAttempts: this.options.maxAttempts,
        maxBatchesPerUserRun: this.options.maxBatchesPerUserRun,
      },
      "Recurrence daily job started.",
    );

    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.pollIntervalMs);

    this.timer.unref?.();
    void this.tick();
  }

  stop() {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
    this.app.log.info(
      { event: "recurrences.job.stopped", jobKey: JOB_KEY },
      "Recurrence daily job stopped.",
    );
  }

  private async tick() {
    if (this.tickRunning) {
      this.app.log.warn(
        { event: "recurrences.job.skip_tick_running", jobKey: JOB_KEY },
        "Skipping recurrence job tick because previous execution is still running.",
      );
      return;
    }

    this.tickRunning = true;
    const startedAt = Date.now();
    let lockAcquired = false;
    let runPromise: Promise<JobRunStats> | null = null;
    let timeoutHandler: NodeJS.Timeout | null = null;
    let timedOut = false;
    let runCompleted = false;

    try {
      lockAcquired = await this.tryAcquireLock();
      if (!lockAcquired) {
        this.app.log.debug?.(
          { event: "recurrences.job.lock_not_acquired", jobKey: JOB_KEY },
          "Recurrence daily job lock not acquired.",
        );
        return;
      }

      runPromise = this.runOnce();
      const timeoutPromise = new Promise<"timeout">((resolve) => {
        timeoutHandler = setTimeout(() => {
          timedOut = true;
          resolve("timeout");
        }, this.options.timeoutMs);
      });

      const raceResult = await Promise.race([
        runPromise
          .then((stats) => ({ status: "done" as const, stats }))
          .catch((error: unknown) => ({ status: "error" as const, error })),
        timeoutPromise.then(() => ({ status: "timeout" as const })),
      ]);

      if (raceResult.status === "done") {
        runCompleted = true;
        this.app.log.info(
          {
            event: "recurrences.job.success",
            jobKey: JOB_KEY,
            durationMs: Date.now() - startedAt,
            ...raceResult.stats,
          },
          "Recurrence daily job finished successfully.",
        );
      } else if (raceResult.status === "error") {
        runCompleted = true;
        this.app.log.error(
          {
            event: "recurrences.job.failed",
            jobKey: JOB_KEY,
            durationMs: Date.now() - startedAt,
            error: raceResult.error,
          },
          "Recurrence daily job failed.",
        );
      } else {
        this.app.log.warn(
          {
            event: "recurrences.job.timeout_waiting_background",
            jobKey: JOB_KEY,
            timeoutMs: this.options.timeoutMs,
          },
          "Job timed out, waiting background execution to finish before releasing lock.",
        );

        if (runPromise) {
          try {
            const statsAfterTimeout = await runPromise;
            runCompleted = true;
            this.app.log.info(
              {
                event: "recurrences.job.completed_after_timeout",
                jobKey: JOB_KEY,
                durationMs: Date.now() - startedAt,
                ...statsAfterTimeout,
              },
              "Recurrence daily job completed after timeout.",
            );
          } catch (backgroundError) {
            runCompleted = true;
            this.app.log.error(
              {
                event: "recurrences.job.failed_after_timeout",
                jobKey: JOB_KEY,
                durationMs: Date.now() - startedAt,
                error: backgroundError,
              },
              "Recurrence daily job background execution failed after timeout.",
            );
          }
        }
      }
    } catch (error) {
      if (!runCompleted) {
        this.app.log.error(
          {
            event: timedOut ? "recurrences.job.failed_after_timeout" : "recurrences.job.failed",
            jobKey: JOB_KEY,
            durationMs: Date.now() - startedAt,
            error,
          },
          "Recurrence daily job failed.",
        );
      }
    } finally {
      if (timeoutHandler) {
        clearTimeout(timeoutHandler);
      }
      if (lockAcquired) {
        await this.releaseLock();
      }
      this.tickRunning = false;
    }
  }

  private async runOnce(): Promise<JobRunStats> {
    const dueUsers = await this.findDueUsers();
    if (dueUsers.length === 0) {
      return {
        usersProcessed: 0,
        usersFailed: 0,
        createdOccurrences: 0,
        skippedOccurrences: 0,
        createdTransactions: 0,
        createdTransfers: 0,
        finalizedRecurrences: 0,
        failedRecurrences: 0,
      };
    }

    const stats: JobRunStats = {
      usersProcessed: 0,
      usersFailed: 0,
      createdOccurrences: 0,
      skippedOccurrences: 0,
      createdTransactions: 0,
      createdTransfers: 0,
      finalizedRecurrences: 0,
      failedRecurrences: 0,
    };

    for (const dueUser of dueUsers) {
      const result = await this.materializeUserWithRetry(dueUser);
      if (!result) {
        stats.usersFailed += 1;
        continue;
      }

      stats.usersProcessed += 1;
      stats.createdOccurrences += result.createdOccurrences;
      stats.skippedOccurrences += result.skippedOccurrences;
      stats.createdTransactions += result.createdTransactions;
      stats.createdTransfers += result.createdTransfers;
      stats.finalizedRecurrences += result.finalizedRecurrences;
      stats.failedRecurrences += result.failedRecurrences;
    }

    return stats;
  }

  private async materializeUserWithRetry(dueUser: DueUser) {
    for (let attempt = 0; attempt < this.options.maxAttempts; attempt += 1) {
      try {
        const materialization = await this.materializeUserInBatches(dueUser.userId);

        this.app.log.info(
          {
            event: "recurrences.job.user.success",
            userId: dueUser.userId,
            timezone: dueUser.timezone,
            attempt: attempt + 1,
            ...materialization,
          },
          "User recurrence materialization completed.",
        );

        return materialization;
      } catch (error) {
        const isLastAttempt = attempt >= this.options.maxAttempts - 1;
        this.app.log[isLastAttempt ? "error" : "warn"](
          {
            event: "recurrences.job.user.retry",
            userId: dueUser.userId,
            timezone: dueUser.timezone,
            attempt: attempt + 1,
            maxAttempts: this.options.maxAttempts,
            error,
          },
          isLastAttempt
            ? "User recurrence materialization failed after retries."
            : "User recurrence materialization failed. Retrying.",
        );

        if (isLastAttempt) {
          return null;
        }

        const delayMs = this.options.retryDelaysMs[attempt] ?? 0;
        await delay(delayMs);
      }
    }

    return null;
  }

  private async materializeUserInBatches(userId: string) {
    const aggregated = {
      totalActiveRecurrences: 0,
      processedRecurrences: 0,
      truncatedByBatch: false,
      remainingRecurrences: 0,
      createdOccurrences: 0,
      skippedOccurrences: 0,
      createdTransactions: 0,
      createdTransfers: 0,
      finalizedRecurrences: 0,
      failedRecurrences: 0,
    };

    for (let batchNumber = 0; batchNumber < this.options.maxBatchesPerUserRun; batchNumber += 1) {
      const materialization = await this.recurrenceService.materialize(userId, {
        maxRecurrences: this.options.batchSize,
      });

      aggregated.totalActiveRecurrences = materialization.totalActiveRecurrences;
      aggregated.processedRecurrences += materialization.processedRecurrences;
      aggregated.truncatedByBatch = materialization.truncatedByBatch;
      aggregated.remainingRecurrences = materialization.remainingRecurrences;
      aggregated.createdOccurrences += materialization.createdOccurrences;
      aggregated.skippedOccurrences += materialization.skippedOccurrences;
      aggregated.createdTransactions += materialization.createdTransactions;
      aggregated.createdTransfers += materialization.createdTransfers;
      aggregated.finalizedRecurrences += materialization.finalizedRecurrences;
      aggregated.failedRecurrences += materialization.failedRecurrences;

      if (!materialization.truncatedByBatch || materialization.remainingRecurrences <= 0) {
        break;
      }
    }

    if (aggregated.truncatedByBatch && aggregated.remainingRecurrences > 0) {
      this.app.log.warn(
        {
          event: "recurrences.job.user.batch_limit_reached",
          userId,
          maxBatchesPerUserRun: this.options.maxBatchesPerUserRun,
          batchSize: this.options.batchSize,
          remainingRecurrences: aggregated.remainingRecurrences,
        },
        "Recurrence materialization reached batch limit for user; backlog remains for next run.",
      );
    }

    return aggregated;
  }

  private async findDueUsers(): Promise<DueUser[]> {
    const result = await this.app.db.execute(sql`
      select distinct
        r.user_id as "userId",
        coalesce(u.timezone, ${DEFAULT_TIMEZONE}) as timezone
      from recurrences r
      inner join users u on u.id = r.user_id
      where r.status = 'active'
        and r.deleted_at is null
        and (
          coalesce(r.next_occurrence_date, r.start_date) < ((now() at time zone coalesce(u.timezone, ${DEFAULT_TIMEZONE}))::date)
          or (
            coalesce(r.next_occurrence_date, r.start_date) = ((now() at time zone coalesce(u.timezone, ${DEFAULT_TIMEZONE}))::date)
            and to_char((now() at time zone coalesce(u.timezone, ${DEFAULT_TIMEZONE})), 'HH24:MI') >= ${this.options.targetTime}
          )
        )
      order by r.user_id asc
    `);

    const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
    return rows
      .map((row) => row as Partial<DueUser>)
      .filter(
        (row): row is DueUser => typeof row.userId === "string" && typeof row.timezone === "string",
      );
  }

  private async tryAcquireLock() {
    const result = await this.app.db.execute(sql`
      insert into job_locks (job_key, owner_id, lock_until, locked_at, updated_at)
      values (
        ${JOB_KEY},
        ${this.ownerId},
        now() + (${this.options.lockTtlMs} * interval '1 millisecond'),
        now(),
        now()
      )
      on conflict (job_key)
      do update set
        owner_id = excluded.owner_id,
        lock_until = excluded.lock_until,
        locked_at = now(),
        updated_at = now()
      where job_locks.lock_until < now()
         or job_locks.owner_id = ${this.ownerId}
      returning owner_id as "ownerId"
    `);

    const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
    return rows.length > 0;
  }

  private async releaseLock() {
    try {
      await this.app.db.execute(sql`
        update job_locks
        set lock_until = now(),
            updated_at = now()
        where job_key = ${JOB_KEY}
          and owner_id = ${this.ownerId}
      `);
    } catch (error) {
      this.app.log.error(
        {
          event: "recurrences.job.release_lock_failed",
          jobKey: JOB_KEY,
          ownerId: this.ownerId,
          error,
        },
        "Failed to release recurrence daily job lock.",
      );
    }
  }
}

export function registerRecurrenceDailyJob(app: FastifyInstance) {
  const recurrenceDailyJob = new RecurrenceDailyJob(app);

  app.addHook("onReady", async () => {
    recurrenceDailyJob.start();
  });

  app.addHook("onClose", async () => {
    recurrenceDailyJob.stop();
  });
}
