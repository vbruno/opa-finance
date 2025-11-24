import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { hashPassword, comparePassword } from "../../core/utils/hash.utils";
import { users } from "../../db/schema";
import type { RegisterInput, LoginInput } from "./auth.schemas";
import type { ChangePasswordInput, ResetPasswordInput } from "./password.schemas";

export class AuthService {
  constructor(
    private app: FastifyInstance,
    private db: any, // Postgres DB (prod/test)
  ) {}

  async register(data: RegisterInput) {
    const { confirmPassword, ...userData } = data;

    const exists = await this.db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (exists.length > 0) {
      throw new Error("E-mail já cadastrado.");
    }

    const passwordHash = await hashPassword(userData.password);

    const [user] = await this.db
      .insert(users)
      .values({
        name: userData.name,
        email: userData.email,
        passwordHash,
      })
      .returning();

    return user;
  }

  async login(data: LoginInput) {
    const [user] = await this.db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (!user) throw new Error("Credenciais inválidas.");

    const valid = await comparePassword(data.password, user.passwordHash);

    if (!valid) throw new Error("Credenciais inválidas.");

    return user;
  }

  generateAccessToken(userId: string) {
    return this.app.jwt.sign({ sub: userId }, { expiresIn: "15m" });
  }

  generateRefreshToken(userId: string) {
    return this.app.jwt.sign({ sub: userId }, { expiresIn: "7d" });
  }

  async changePassword(userId: string, data: ChangePasswordInput) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!user) throw new Error("Usuário não encontrado.");

    const valid = await comparePassword(data.currentPassword, user.passwordHash);
    if (!valid) throw new Error("Senha atual incorreta.");

    const newHash = await hashPassword(data.newPassword);

    await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));

    return { message: "Senha alterada com sucesso." };
  }

  async forgotPassword(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));

    if (!user) throw new Error("Usuário não encontrado.");

    const token = this.app.jwt.sign({ sub: user.id, type: "reset" }, { expiresIn: "15m" });

    return { resetToken: token, email: user.email };
  }

  async resetPassword(data: ResetPasswordInput) {
    const payload = this.app.jwt.verify(data.token) as any;

    if (payload.type !== "reset") {
      throw new Error("Token inválido.");
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub));

    if (!user) throw new Error("Usuário não encontrado.");

    const newHash = await hashPassword(data.newPassword);

    await this.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, payload.sub));

    return { message: "Senha redefinida com sucesso." };
  }
}
