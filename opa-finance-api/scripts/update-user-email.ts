import { randomInt } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import dotenv from "dotenv";
import { Pool } from "pg";
import { z } from "zod";

const operationCanceledMessage = "Operação cancelada.";

type ParsedArgs = {
  email?: string;
  name?: string;
  userId?: string;
  newEmail?: string;
  yes: boolean;
  help: boolean;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
};

type UserResolutionResult =
  | {
      action: "selected";
      user: UserRow;
    }
  | {
      action: "back";
    };

const databaseUrlSchema = z.string().url();
const userIdSchema = z.string().uuid("ID de usuário inválido.");
const emailSchema = z.string().email("E-mail inválido.").max(255, "O e-mail é muito longo.");
const emailSearchSchema = z
  .string()
  .trim()
  .min(2, "Informe pelo menos 2 caracteres para buscar por e-mail.")
  .max(255, "A busca por e-mail é muito longa.");
const nameSearchSchema = z
  .string()
  .trim()
  .min(2, "Informe pelo menos 2 caracteres para buscar por nome.")
  .max(255, "A busca por nome é muito longa.");

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { help: false, yes: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--yes" || arg === "-y") {
      parsed.yes = true;
      continue;
    }

    if (arg === "--email") {
      parsed.email = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--email=")) {
      parsed.email = arg.slice("--email=".length);
      continue;
    }

    if (arg === "--name") {
      parsed.name = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--name=")) {
      parsed.name = arg.slice("--name=".length);
      continue;
    }

    if (arg === "--user-id") {
      parsed.userId = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--user-id=")) {
      parsed.userId = arg.slice("--user-id=".length);
      continue;
    }

    if (arg === "--new-email") {
      parsed.newEmail = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--new-email=")) {
      parsed.newEmail = arg.slice("--new-email=".length);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    throw new Error(`Argumento inválido: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Uso:
  npm run user:update-email
  npm run user:update-email -- --email atual@exemplo.com --new-email novo@exemplo.com
  npm run user:update-email -- --user-id <uuid> --new-email novo@exemplo.com --yes

Opções:
  --email <email>          e-mail atual do usuário
  --name <nome>            busca usuário pelo nome
  --user-id <uuid>         ID do usuário
  --new-email <email>      novo e-mail
  --yes, -y                pula confirmação interativa
  -h, --help               mostra esta ajuda`);
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join(" ");
}

function parseEmail(value: string) {
  const result = emailSchema.safeParse(value.trim());
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
}

function parseEmailSearch(value: string) {
  const result = emailSearchSchema.safeParse(value);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
}

function parseNameSearch(value: string) {
  const result = nameSearchSchema.safeParse(value);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
}

function parseUserId(value: string) {
  const result = userIdSchema.safeParse(value.trim());
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }

  return result.data;
}

async function questionRequired(rl: ReturnType<typeof createInterface>, label: string) {
  const answer = (await rl.question(label)).trim();
  if (!answer) {
    throw new Error("Valor obrigatório não informado.");
  }
  return answer;
}

async function chooseMenuAction(rl: ReturnType<typeof createInterface>) {
  while (true) {
    console.log("");
    console.log("============================================");
    console.log("       Atualização operacional de e-mail    ");
    console.log("============================================");
    console.log("");
    console.log("1) Alterar e-mail de usuário");
    console.log("2) Ajuda");
    console.log("3) Cancelar");
    console.log("");

    const option = (await rl.question("Escolha uma opção (1/2/3): ")).trim();

    if (option === "1") return "update" as const;
    if (option === "2") return "help" as const;
    if (option === "3") return "cancel" as const;

    console.log("Erro: opção inválida.");
  }
}

async function chooseSearchMode(rl: ReturnType<typeof createInterface>) {
  while (true) {
    console.log("");
    console.log("Buscar usuário por:");
    console.log("0) Voltar");
    console.log("1) E-mail");
    console.log("2) Nome");
    console.log("3) ID");
    console.log("");

    const option = (await rl.question("Escolha uma opção (0/1/2/3): ")).trim();

    if (option === "0") return "back" as const;
    if (option === "1") return "email" as const;
    if (option === "2") return "name" as const;
    if (option === "3") return "id" as const;

    console.log("Erro: opção inválida.");
  }
}

function escapeLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function shuffleCharacters(value: string) {
  const characters = value.split("");

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}

function generateConfirmationKey() {
  const letter = String.fromCharCode("A".charCodeAt(0) + randomInt(26));
  const numbers = Array.from({ length: 3 }, () => randomInt(10).toString()).join("");

  return shuffleCharacters(`${letter}${numbers}`);
}

function createDatabasePool() {
  dotenv.config({ quiet: true });

  const databaseUrlResult = databaseUrlSchema.safeParse(process.env.DATABASE_URL);
  if (!databaseUrlResult.success) {
    throw new Error("DATABASE_URL inválida ou não configurada.");
  }

  return new Pool({ connectionString: databaseUrlResult.data });
}

async function selectUserById(pool: Pool, userId: string): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    "SELECT id, email, name FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );
  const user = result.rows[0];
  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  return user;
}

async function selectUserByEmail(pool: Pool, email: string): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    "SELECT id, email, name FROM users WHERE email = $1 LIMIT 1",
    [email],
  );
  const user = result.rows[0];
  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  return user;
}

async function searchUsersByEmail(pool: Pool, email: string): Promise<UserRow[]> {
  const emailPattern = `%${escapeLikePattern(email)}%`;
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, name
      FROM users
      WHERE email ILIKE $1 ESCAPE '\\'
      ORDER BY email ASC, name ASC
      LIMIT 20
    `,
    [emailPattern],
  );

  return result.rows;
}

async function searchUsersByName(pool: Pool, name: string): Promise<UserRow[]> {
  const namePattern = `%${escapeLikePattern(name)}%`;
  const result = await pool.query<UserRow>(
    `
      SELECT id, email, name
      FROM users
      WHERE name ILIKE $1 ESCAPE '\\'
      ORDER BY name ASC, email ASC
      LIMIT 20
    `,
    [namePattern],
  );

  return result.rows;
}

async function chooseUserFromSearchResults(
  rl: ReturnType<typeof createInterface>,
  users: UserRow[],
  allowBack: boolean,
): Promise<UserRow | "back"> {
  if (users.length === 0) {
    throw new Error("Nenhum usuário encontrado.");
  }

  if (users.length === 1) {
    const [user] = users;
    console.log(`Usuário encontrado: ${user.name} <${user.email}>`);
    return user;
  }

  if (!input.isTTY) {
    throw new Error("A busca retornou múltiplos usuários. Execute em modo interativo.");
  }

  console.log("");
  console.log("Usuários encontrados:");
  if (allowBack) {
    console.log("0) Voltar");
  }
  users.forEach((user, index) => {
    console.log(`${index + 1}) ${user.name} <${user.email}> (${user.id})`);
  });
  console.log("");

  while (true) {
    const option = await questionRequired(rl, "Escolha o usuário pelo número: ");
    if (allowBack && option === "0") {
      return "back";
    }

    const selectedIndex = Number.parseInt(option, 10) - 1;
    const user = users[selectedIndex];

    if (Number.isInteger(selectedIndex) && user) {
      return user;
    }

    if (!allowBack) {
      throw new Error("Usuário selecionado inválido.");
    }

    console.log("Erro: usuário selecionado inválido.");
  }
}

async function promptEmailSearch(rl: ReturnType<typeof createInterface>, allowBack: boolean) {
  while (true) {
    const value = await questionRequired(
      rl,
      allowBack ? "E-mail ou parte do e-mail (ou 0 para voltar): " : "E-mail ou parte do e-mail: ",
    );
    if (allowBack && value === "0") {
      return "back" as const;
    }

    try {
      return parseEmailSearch(value);
    } catch (error) {
      if (!allowBack) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "E-mail inválido.";
      console.log(`Erro: ${message}`);
    }
  }
}

async function promptNameSearch(rl: ReturnType<typeof createInterface>, allowBack: boolean) {
  while (true) {
    const value = await questionRequired(
      rl,
      allowBack ? "Nome do usuário (ou 0 para voltar): " : "Nome do usuário: ",
    );
    if (allowBack && value === "0") {
      return "back" as const;
    }

    try {
      return parseNameSearch(value);
    } catch (error) {
      if (!allowBack) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Nome inválido.";
      console.log(`Erro: ${message}`);
    }
  }
}

async function promptUserId(rl: ReturnType<typeof createInterface>, allowBack: boolean) {
  while (true) {
    const value = await questionRequired(
      rl,
      allowBack ? "ID do usuário (ou 0 para voltar): " : "ID do usuário: ",
    );
    if (allowBack && value === "0") {
      return "back" as const;
    }

    try {
      return parseUserId(value);
    } catch (error) {
      if (!allowBack) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "ID inválido.";
      console.log(`Erro: ${message}`);
    }
  }
}

async function promptNewEmail(
  rl: ReturnType<typeof createInterface>,
  currentEmail: string,
  allowBack: boolean,
) {
  while (true) {
    const value = await questionRequired(
      rl,
      allowBack ? "Novo e-mail (ou 0 para voltar): " : "Novo e-mail: ",
    );
    if (allowBack && value === "0") {
      return "back" as const;
    }

    try {
      const email = parseEmail(value).toLowerCase();
      if (email === currentEmail.toLowerCase()) {
        console.log("Erro: o novo e-mail deve ser diferente do e-mail atual.");
        continue;
      }

      return email;
    } catch (error) {
      if (!allowBack) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "E-mail inválido.";
      console.log(`Erro: ${message}`);
    }
  }
}

async function resolveUser(
  rl: ReturnType<typeof createInterface>,
  pool: Pool,
  args: ParsedArgs,
  allowBack: boolean,
): Promise<UserResolutionResult> {
  const identifiers = [args.email, args.name, args.userId].filter(Boolean);
  if (identifiers.length > 1) {
    throw new Error("Use apenas --email, --name ou --user-id.");
  }

  if (args.userId) {
    const userId = parseUserId(args.userId);
    return { action: "selected", user: await selectUserById(pool, userId) };
  }

  if (args.email) {
    const email = parseEmail(args.email);
    return { action: "selected", user: await selectUserByEmail(pool, email) };
  }

  if (args.name) {
    const name = parseNameSearch(args.name);
    const user = await chooseUserFromSearchResults(rl, await searchUsersByName(pool, name), false);
    if (user === "back") {
      return { action: "back" };
    }
    return { action: "selected", user };
  }

  const searchMode = input.isTTY ? await chooseSearchMode(rl) : "email";
  if (searchMode === "back") {
    return { action: "back" };
  }

  if (searchMode === "id") {
    while (true) {
      const userId = await promptUserId(rl, allowBack);
      if (userId === "back") {
        return { action: "back" };
      }

      try {
        return { action: "selected", user: await selectUserById(pool, userId) };
      } catch (error) {
        if (!allowBack) {
          throw error;
        }

        const message = error instanceof Error ? error.message : "Usuário não encontrado.";
        console.log(`Erro: ${message}`);
      }
    }
  }

  if (searchMode === "name") {
    while (true) {
      const name = await promptNameSearch(rl, allowBack);
      if (name === "back") {
        return { action: "back" };
      }

      const users = await searchUsersByName(pool, name);
      if (users.length === 0) {
        if (!allowBack) {
          throw new Error("Nenhum usuário encontrado para o nome informado.");
        }

        console.log("Erro: nenhum usuário encontrado para o nome informado.");
        continue;
      }

      const user = await chooseUserFromSearchResults(rl, users, allowBack);
      if (user === "back") {
        return { action: "back" };
      }

      return { action: "selected", user };
    }
  }

  while (true) {
    const email = await promptEmailSearch(rl, allowBack);
    if (email === "back") {
      return { action: "back" };
    }

    const users = await searchUsersByEmail(pool, email);
    if (users.length === 0) {
      if (!allowBack) {
        throw new Error("Nenhum usuário encontrado para o e-mail informado.");
      }

      console.log("Erro: nenhum usuário encontrado para o e-mail informado.");
      continue;
    }

    const user = await chooseUserFromSearchResults(rl, users, allowBack);
    if (user === "back") {
      return { action: "back" };
    }

    return { action: "selected", user };
  }
}

async function ensureEmailAvailable(pool: Pool, newEmail: string, currentUserId: string) {
  const result = await pool.query<UserRow>(
    "SELECT id, email, name FROM users WHERE email = $1 LIMIT 1",
    [newEmail],
  );
  const existingUser = result.rows[0];

  if (existingUser && existingUser.id !== currentUserId) {
    throw new Error(`E-mail já está em uso por ${existingUser.name} <${existingUser.email}>.`);
  }
}

async function updateEmailForUser(
  rl: ReturnType<typeof createInterface>,
  pool: Pool,
  args: ParsedArgs,
  user: UserRow,
  allowBack: boolean,
) {
  while (true) {
    const newEmail = args.newEmail
      ? parseEmail(args.newEmail).toLowerCase()
      : await promptNewEmail(rl, user.email, allowBack);

    if (newEmail === "back") {
      return "back" as const;
    }

    if (newEmail === user.email.toLowerCase()) {
      if (!allowBack) {
        throw new Error("O novo e-mail deve ser diferente do e-mail atual.");
      }

      console.log("Erro: o novo e-mail deve ser diferente do e-mail atual.");
      continue;
    }

    try {
      await ensureEmailAvailable(pool, newEmail, user.id);
    } catch (error) {
      if (!allowBack) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "E-mail indisponível.";
      console.log(`Erro: ${message}`);
      continue;
    }

    if (!args.yes) {
      console.log("");
      console.log("Esta operação altera o e-mail de login diretamente no banco.");
      console.log(`Usuário: ${user.name}`);
      console.log(`E-mail atual: ${user.email}`);
      console.log(`Novo e-mail: ${newEmail}`);
      const confirmationKey = allowBack ? generateConfirmationKey() : "ALTERAR";
      const confirmation = await questionRequired(
        rl,
        allowBack
          ? `Digite ${confirmationKey} para confirmar ou 0 para voltar: `
          : "Digite ALTERAR para confirmar: ",
      );

      if (allowBack && confirmation === "0") {
        return "back" as const;
      }

      if (confirmation !== confirmationKey) {
        console.log(operationCanceledMessage);
        return "completed" as const;
      }
    }

    await pool.query("BEGIN");
    await pool.query("UPDATE users SET email = $1 WHERE id = $2", [newEmail, user.id]);

    const resetTokensTable = await pool.query<{ exists: string | null }>(
      "SELECT to_regclass('public.password_reset_tokens')::text AS exists",
    );

    let invalidatedResetTokens = 0;
    if (resetTokensTable.rows[0]?.exists) {
      const resetResult = await pool.query(
        "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
        [user.id],
      );
      invalidatedResetTokens = resetResult.rowCount ?? 0;
    }

    await pool.query("COMMIT");

    console.log("");
    console.log("E-mail alterado com sucesso.");
    console.log(`Usuário: ${user.name}`);
    console.log(`E-mail anterior: ${user.email}`);
    console.log(`Novo e-mail: ${newEmail}`);
    console.log(`Tokens de reset invalidados: ${invalidatedResetTokens}`);

    return "completed" as const;
  }
}

async function runUpdateEmailFlow(
  rl: ReturnType<typeof createInterface>,
  pool: Pool,
  args: ParsedArgs,
  allowBack: boolean,
) {
  while (true) {
    const userResult = await resolveUser(rl, pool, args, allowBack);
    if (userResult.action === "back") {
      return "back" as const;
    }

    const updateResult = await updateEmailForUser(rl, pool, args, userResult.user, allowBack);
    if (updateResult === "back") {
      continue;
    }

    return "completed" as const;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const rl = createInterface({ input, output });

  try {
    if (args.help) {
      printHelp();
      return;
    }

    const isInteractiveWizard = argv.length === 0 && input.isTTY;

    if (isInteractiveWizard) {
      while (true) {
        const action = await chooseMenuAction(rl);
        if (action === "help") {
          printHelp();
          continue;
        }
        if (action === "cancel") {
          console.log(operationCanceledMessage);
          return;
        }

        const pool = createDatabasePool();
        try {
          const result = await runUpdateEmailFlow(rl, pool, args, true);
          if (result === "completed") {
            return;
          }
        } catch (error) {
          await pool.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          await pool.end();
        }
      }
    }

    const pool = createDatabasePool();
    try {
      const result = await runUpdateEmailFlow(rl, pool, args, false);
      if (result === "back") {
        console.log(operationCanceledMessage);
        return;
      }
    } catch (error) {
      await pool.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await pool.end();
    }
  } finally {
    rl.close();
  }
}

process.on("SIGINT", () => {
  console.log(`\n${operationCanceledMessage}`);
  process.exit(130);
});

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido.";

  if (message === operationCanceledMessage) {
    console.log(message);
    process.exit(130);
  }

  console.error(`Erro: ${message}`);
  process.exit(1);
});
