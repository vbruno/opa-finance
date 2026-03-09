// src/modules/accounts/account.service.ts
import { eq, and, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { NotFoundProblem, ForbiddenProblem, ConflictProblem } from "../../core/errors/problems";

import { accounts, transactions } from "../../db/schema";
import { AuditService } from "../audit/audit.service";
import type { CreateAccountInput, UpdateAccountInput } from "./account.schemas";

export class AccountService {
  private audit: AuditService;

  constructor(private app: FastifyInstance) {
    this.audit = new AuditService(app);
  }

  private buildCurrentBalanceExpr() {
    return sql<number>`(coalesce(sum(case
      when ${transactions.type} = 'income' then ${transactions.amount}
      when ${transactions.type} = 'expense' then -${transactions.amount}
      else 0 end), 0))`;
  }

  private accountGroupByColumns() {
    return [
      accounts.id,
      accounts.userId,
      accounts.name,
      accounts.type,
      accounts.initialBalance,
      accounts.color,
      accounts.icon,
      accounts.isPrimary,
      accounts.isHiddenOnDashboard,
      accounts.createdAt,
      accounts.updatedAt,
    ];
  }

  private handlePrimaryConflict(error: unknown, path: string) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictProblem("Já existe uma conta principal para este usuário.", path);
      }
    }
  }

  private toAuditAccount(account: Awaited<ReturnType<AccountService["getOne"]>>) {
    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      color: account.color,
      icon: account.icon,
      isPrimary: account.isPrimary,
      isHiddenOnDashboard: account.isHiddenOnDashboard,
      currentBalance: account.currentBalance,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                   CREATE                                   */
  /* -------------------------------------------------------------------------- */
  async create(userId: string, data: CreateAccountInput) {
    try {
      const account = await this.app.db.transaction(async (tx: typeof this.app.db) => {
        const [currentPrimary] = await tx
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.isPrimary, true)))
          .limit(1);

        const shouldBePrimary = data.isPrimary === true || !currentPrimary;
        const shouldHideOnDashboard = shouldBePrimary ? false : (data.isHiddenOnDashboard ?? false);

        if (shouldBePrimary) {
          await tx.update(accounts).set({ isPrimary: false }).where(eq(accounts.userId, userId));
        }

        const [created] = await tx
          .insert(accounts)
          .values({
            ...data,
            initialBalance: 0,
            isPrimary: shouldBePrimary,
            isHiddenOnDashboard: shouldHideOnDashboard,
            userId,
          })
          .returning();

        const { initialBalance, ...rest } = created;
        void initialBalance;
        const createdWithBalance = {
          ...rest,
          currentBalance: 0,
        };

        await this.audit.log(
          {
            userId,
            entityType: "account",
            entityId: createdWithBalance.id,
            action: "create",
            afterData: this.toAuditAccount(createdWithBalance),
          },
          tx,
        );

        return created;
      });

      const { initialBalance, ...rest } = account;
      void initialBalance;
      const result = {
        ...rest,
        currentBalance: 0,
      };

      return result;
    } catch (error) {
      this.handlePrimaryConflict(error, "/accounts");
      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                    LIST                                    */
  /* -------------------------------------------------------------------------- */
  async list(userId: string) {
    const currentBalance = this.buildCurrentBalanceExpr();
    const rows = await this.app.db
      .select({
        account: accounts,
        currentBalance,
      })
      .from(accounts)
      .leftJoin(
        transactions,
        and(eq(transactions.accountId, accounts.id), eq(transactions.userId, accounts.userId)),
      )
      .where(eq(accounts.userId, userId))
      .groupBy(...this.accountGroupByColumns());

    return rows.map((row: (typeof rows)[number]) => {
      const { initialBalance, ...rest } = row.account;
      void initialBalance;
      return {
        ...rest,
        currentBalance: Number(row.currentBalance),
      };
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                                  GET ONE                                   */
  /* -------------------------------------------------------------------------- */
  async getOne(id: string, userId: string) {
    const currentBalance = this.buildCurrentBalanceExpr();
    const [row] = await this.app.db
      .select({
        account: accounts,
        currentBalance,
      })
      .from(accounts)
      .leftJoin(
        transactions,
        and(eq(transactions.accountId, accounts.id), eq(transactions.userId, accounts.userId)),
      )
      .where(eq(accounts.id, id))
      .groupBy(...this.accountGroupByColumns());

    if (!row?.account) {
      throw new NotFoundProblem("Conta não encontrada.", `/accounts/${id}`);
    }

    if (row.account.userId !== userId) {
      throw new ForbiddenProblem("Você não tem acesso a esta conta.", `/accounts/${id}`);
    }

    const { initialBalance, ...rest } = row.account;
    void initialBalance;
    return {
      ...rest,
      currentBalance: Number(row.currentBalance),
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                                  UPDATE                                    */
  /* -------------------------------------------------------------------------- */
  async update(id: string, userId: string, data: UpdateAccountInput) {
    const current = await this.getOne(id, userId); // já valida 404 e 403
    const currentAudit = this.toAuditAccount(current);

    try {
      await this.app.db.transaction(async (tx: typeof this.app.db) => {
        if (current.isPrimary === true && data.isHiddenOnDashboard === true) {
          throw new ConflictProblem(
            "A conta principal não pode ser ocultada no dashboard.",
            `/accounts/${id}`,
          );
        }

        if (data.isPrimary === false && current.isPrimary === true) {
          throw new ConflictProblem(
            "A conta principal não pode ser desmarcada sem definir outra conta principal.",
            `/accounts/${id}`,
          );
        }

        const updateData: UpdateAccountInput = { ...data };
        if (data.isPrimary === true) {
          await tx.update(accounts).set({ isPrimary: false }).where(eq(accounts.userId, userId));
          updateData.isHiddenOnDashboard = false;
        }

        const [row] = await tx
          .update(accounts)
          .set(updateData)
          .where(eq(accounts.id, id))
          .returning();

        const currentBalanceExpr = this.buildCurrentBalanceExpr();
        const [updatedWithBalance] = await tx
          .select({
            account: accounts,
            currentBalance: currentBalanceExpr,
          })
          .from(accounts)
          .leftJoin(
            transactions,
            and(eq(transactions.accountId, accounts.id), eq(transactions.userId, accounts.userId)),
          )
          .where(eq(accounts.id, id))
          .groupBy(...this.accountGroupByColumns());

        if (updatedWithBalance?.account) {
          const { initialBalance, ...rest } = updatedWithBalance.account;
          void initialBalance;
          await this.audit.log(
            {
              userId,
              entityType: "account",
              entityId: rest.id,
              action: "update",
              beforeData: currentAudit,
              afterData: this.toAuditAccount({
                ...rest,
                currentBalance: Number(updatedWithBalance.currentBalance),
              }),
            },
            tx,
          );
        } else if (row) {
          await this.audit.log(
            {
              userId,
              entityType: "account",
              entityId: row.id,
              action: "update",
              beforeData: currentAudit,
            },
            tx,
          );
        }
        return row;
      });

      return await this.getOne(id, userId);
    } catch (error) {
      this.handlePrimaryConflict(error, `/accounts/${id}`);
      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                               SET PRIMARY                                  */
  /* -------------------------------------------------------------------------- */
  async setPrimary(id: string, userId: string) {
    const current = await this.getOne(id, userId);
    const currentAudit = this.toAuditAccount(current);

    try {
      await this.app.db.transaction(async (tx: typeof this.app.db) => {
        await tx.update(accounts).set({ isPrimary: false }).where(eq(accounts.userId, userId));

        const [row] = await tx
          .update(accounts)
          .set({ isPrimary: true, isHiddenOnDashboard: false })
          .where(eq(accounts.id, id))
          .returning();

        const currentBalanceExpr = this.buildCurrentBalanceExpr();
        const [updatedWithBalance] = await tx
          .select({
            account: accounts,
            currentBalance: currentBalanceExpr,
          })
          .from(accounts)
          .leftJoin(
            transactions,
            and(eq(transactions.accountId, accounts.id), eq(transactions.userId, accounts.userId)),
          )
          .where(eq(accounts.id, id))
          .groupBy(...this.accountGroupByColumns());

        if (updatedWithBalance?.account) {
          const { initialBalance, ...rest } = updatedWithBalance.account;
          void initialBalance;
          await this.audit.log(
            {
              userId,
              entityType: "account",
              entityId: rest.id,
              action: "update",
              beforeData: currentAudit,
              afterData: this.toAuditAccount({
                ...rest,
                currentBalance: Number(updatedWithBalance.currentBalance),
              }),
              metadata: { operation: "set-primary" },
            },
            tx,
          );
        } else if (row) {
          await this.audit.log(
            {
              userId,
              entityType: "account",
              entityId: row.id,
              action: "update",
              beforeData: currentAudit,
              metadata: { operation: "set-primary" },
            },
            tx,
          );
        }

        return row;
      });

      return await this.getOne(id, userId);
    } catch (error) {
      this.handlePrimaryConflict(error, `/accounts/${id}/primary`);
      throw error;
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                  DELETE                                    */
  /* -------------------------------------------------------------------------- */
  async delete(id: string, userId: string) {
    const current = await this.getOne(id, userId);
    const currentAudit = this.toAuditAccount(current);

    if (current.isPrimary === true) {
      throw new ConflictProblem(
        "A conta principal não pode ser removida. Defina outra conta como principal antes.",
        `/accounts/${id}`,
      );
    }

    const [tx] = await this.app.db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.accountId, id))
      .limit(1);

    if (tx) {
      throw new ConflictProblem(
        "Conta possui transações e não pode ser removida.",
        `/accounts/${id}`,
      );
    }

    await this.app.db.transaction(async (txDb: typeof this.app.db) => {
      await txDb.delete(accounts).where(eq(accounts.id, id));
      await this.audit.log(
        {
          userId,
          entityType: "account",
          entityId: id,
          action: "delete",
          beforeData: currentAudit,
        },
        txDb,
      );
    });

    return { message: "Conta removida com sucesso." };
  }
}
