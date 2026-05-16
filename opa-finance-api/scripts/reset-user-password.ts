import { randomInt } from "node:crypto";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import dotenv from "dotenv";
import { Pool } from "pg";
import { z } from "zod";

import { hashPassword } from "../src/core/utils/hash.utils";
import { strongPasswordSchema } from "../src/modules/auth/password.schemas";

const operationCanceledMessage = "Operação cancelada.";

type ParsedArgs = {
  email?: string;
  name?: string;
  password?: string;
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

type PasswordResolutionResult =
  | {
      action: "selected";
      password: string;
    }
  | {
      action: "back";
    };

const databaseUrlSchema = z.string().url();
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

    if (arg === "--password") {
      parsed.password = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith("--password=")) {
      parsed.password = arg.slice("--password=".length);
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
  npm run user:reset-password -- --email usuario@exemplo.com
  npm run user:reset-password -- --name "Nome do Usuário"
  RESET_USER_PASSWORD='SenhaForte1!' npm run user:reset-password -- --email usuario@exemplo.com --yes

Opções:
  --email <email>       e-mail do usuário
  --name <nome>         busca usuário pelo nome
  --password <senha>    nova senha (evite em terminais compartilhados)
  --yes, -y             pula confirmação interativa
  -h, --help            mostra esta ajuda`);
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

function parseNameSearch(value: string) {
  const result = nameSearchSchema.safeParse(value);
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

async function questionRequired(rl: ReturnType<typeof createInterface>, label: string) {
  const answer = (await rl.question(label)).trim();
  if (!answer) {
    throw new Error("Valor obrigatório não informado.");
  }
  return answer;
}

async function questionHidden(
  rl: ReturnType<typeof createInterface>,
  label: string,
): Promise<string> {
  if (!input.isTTY || !input.setRawMode) {
    return questionRequired(rl, label);
  }

  rl.pause();

  return await new Promise((resolve, reject) => {
    let answer = "";
    let isSettled = false;
    const previousRawMode = input.isRaw;

    function cleanup() {
      input.off("data", onData);
      input.setRawMode(previousRawMode);
      rl.resume();
    }

    function settleWithError(error: Error) {
      if (isSettled) return;

      isSettled = true;
      cleanup();
      output.write("\n");
      reject(error);
    }

    function settleWithAnswer() {
      if (isSettled) return;

      isSettled = true;
      cleanup();
      output.write("\n");
      resolve(answer);
    }

    function onData(buffer: Buffer) {
      const value = buffer.toString("utf8");

      for (const char of value) {
        if (char === "\u0003") {
          settleWithError(new Error(operationCanceledMessage));
          return;
        }

        if (char === "\r" || char === "\n") {
          settleWithAnswer();
          return;
        }

        if (char === "\u007f" || char === "\b") {
          answer = answer.slice(0, -1);
          continue;
        }

        answer += char;
      }
    }

    output.write(label);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function chooseMenuAction(rl: ReturnType<typeof createInterface>) {
  while (true) {
    console.log("");
    console.log("============================================");
    console.log("      Recuperação operacional de senha      ");
    console.log("============================================");
    console.log("");
    console.log("1) Alterar senha de usuário");
    console.log("2) Ajuda");
    console.log("3) Cancelar");
    console.log("");

    const option = (await rl.question("Escolha uma opção (1/2/3): ")).trim();

    if (option === "1") return "reset" as const;
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
    console.log("");

    const option = (await rl.question("Escolha uma opção (0/1/2): ")).trim();

    if (option === "0") return "back" as const;
    if (option === "1") return "email" as const;
    if (option === "2") return "name" as const;

    console.log("Erro: opção inválida.");
  }
}

async function resolvePassword(
  rl: ReturnType<typeof createInterface>,
  args: ParsedArgs,
  allowBack: boolean,
): Promise<PasswordResolutionResult> {
  const providedPassword = args.password ?? process.env.RESET_USER_PASSWORD;

  if (providedPassword) {
    return { action: "selected", password: providedPassword };
  }

  while (true) {
    const password = await questionHidden(
      rl,
      allowBack ? "Nova senha (ou 0 para voltar): " : "Nova senha: ",
    );
    if (allowBack && password === "0") {
      return { action: "back" };
    }

    const confirmation = await questionHidden(
      rl,
      allowBack ? "Confirme a nova senha (ou 0 para voltar): " : "Confirme a nova senha: ",
    );
    if (allowBack && confirmation === "0") {
      return { action: "back" };
    }

    if (password === confirmation) {
      return { action: "selected", password };
    }

    if (!allowBack) {
      throw new Error("As senhas não conferem.");
    }

    console.log("Erro: as senhas não conferem.");
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

  const databaseUrl = databaseUrlResult.data;
  return new Pool({ connectionString: databaseUrl });
}

async function selectUserByEmail(pool: Pool, email: string): Promise<UserRow> {
  const userResult = await pool.query<UserRow>(
    "SELECT id, email, name FROM users WHERE email = $1 LIMIT 1",
    [email],
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  return user;
}

async function searchUsersByName(pool: Pool, name: string): Promise<UserRow[]> {
  const namePattern = `%${escapeLikePattern(name)}%`;
  const userResult = await pool.query<UserRow>(
    `
      SELECT id, email, name
      FROM users
      WHERE name ILIKE $1 ESCAPE '\\'
      ORDER BY name ASC, email ASC
      LIMIT 20
    `,
    [namePattern],
  );

  return userResult.rows;
}

async function searchUsersByEmail(pool: Pool, email: string): Promise<UserRow[]> {
  const emailPattern = `%${escapeLikePattern(email)}%`;
  const userResult = await pool.query<UserRow>(
    `
      SELECT id, email, name
      FROM users
      WHERE email ILIKE $1 ESCAPE '\\'
      ORDER BY email ASC, name ASC
      LIMIT 20
    `,
    [emailPattern],
  );

  return userResult.rows;
}

async function chooseUserFromSearchResults(
  rl: ReturnType<typeof createInterface>,
  users: UserRow[],
  allowBack: boolean,
): Promise<UserRow | "back"> {
  if (users.length === 0) {
    throw new Error("Nenhum usuário encontrado para o nome informado.");
  }

  if (users.length === 1) {
    const [user] = users;
    console.log(`Usuário encontrado: ${user.name} <${user.email}>`);
    return user;
  }

  if (!input.isTTY) {
    throw new Error(
      "A busca retornou múltiplos usuários. Execute em modo interativo ou use --email.",
    );
  }

  console.log("");
  console.log("Usuários encontrados:");
  if (allowBack) {
    console.log("0) Voltar");
  }
  users.forEach((user, index) => {
    console.log(`${index + 1}) ${user.name} <${user.email}>`);
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
    const emailInput = await questionRequired(
      rl,
      allowBack ? "E-mail ou parte do e-mail (ou 0 para voltar): " : "E-mail ou parte do e-mail: ",
    );
    if (allowBack && emailInput === "0") {
      return "back" as const;
    }

    try {
      return parseEmailSearch(emailInput);
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
    const nameInput = await questionRequired(
      rl,
      allowBack ? "Nome do usuário (ou 0 para voltar): " : "Nome do usuário: ",
    );
    if (allowBack && nameInput === "0") {
      return "back" as const;
    }

    try {
      return parseNameSearch(nameInput);
    } catch (error) {
      if (!allowBack) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Nome inválido.";
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
  if (args.email && args.name) {
    throw new Error("Use apenas --email ou --name, não ambos.");
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

async function resetPasswordForUser(
  rl: ReturnType<typeof createInterface>,
  pool: Pool,
  args: ParsedArgs,
  user: UserRow,
  allowBack: boolean,
) {
  while (true) {
    const passwordResult = await resolvePassword(rl, args, allowBack);
    if (passwordResult.action === "back") {
      return "back" as const;
    }

    const passwordValidation = strongPasswordSchema.safeParse(passwordResult.password);
    if (!passwordValidation.success) {
      const messages = passwordValidation.error.issues.map((issue) => issue.message).join(" ");
      if (!allowBack) {
        throw new Error(messages);
      }

      console.log(`Erro: ${messages}`);
      continue;
    }

    if (!args.yes) {
      console.log("");
      console.log("Esta operação altera a senha diretamente no banco.");
      console.log(`Usuário: ${user.name} <${user.email}>`);
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
        console.log("Operação cancelada.");
        return "completed" as const;
      }
    }

    const passwordHash = await hashPassword(passwordValidation.data);

    await pool.query("BEGIN");
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, user.id]);

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
    console.log("Senha alterada com sucesso.");
    console.log(`Usuário: ${user.name} <${user.email}>`);
    console.log(`Tokens de reset invalidados: ${invalidatedResetTokens}`);

    return "completed" as const;
  }
}

async function runResetFlow(
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

    const resetResult = await resetPasswordForUser(rl, pool, args, userResult.user, allowBack);
    if (resetResult === "back") {
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
          console.log("Operação cancelada.");
          return;
        }

        const pool = createDatabasePool();
        try {
          const result = await runResetFlow(rl, pool, args, true);
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
      const result = await runResetFlow(rl, pool, args, false);
      if (result === "back") {
        console.log("Operação cancelada.");
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido.";

  if (message === operationCanceledMessage) {
    console.log(message);
    process.exit(130);
  }

  console.error(`Erro: ${message}`);
  process.exit(1);
});
