import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { db } from "../../core/plugins/drizzle";
import { users } from "../../db/schema";

const registerBodySchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string().min(6),
});
type RegisterBody = z.infer<typeof registerBodySchema>;

export async function registerUser(
  req: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply,
) {
  const body = registerBodySchema.parse(req.body);

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existingUser) {
    return reply.code(409).send({ message: "E-mail já cadastrado." });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);

  await db.insert(users).values({
    name: body.name,
    email: body.email,
    passwordHash,
  });

  return reply.code(201).send({ message: "Usuário criado!" });
}
