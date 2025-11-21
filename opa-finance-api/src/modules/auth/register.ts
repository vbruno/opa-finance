import { db } from "../../core/plugins/drizzle";
import { users } from "../../db/schema";
import bcrypt from "bcrypt";
import { z } from "zod";

export async function registerUser(req, reply) {
  const body = z
    .object({
      name: z.string(),
      email: z.string().email(),
      password: z.string().min(6),
    })
    .parse(req.body);

  const passwordHash = await bcrypt.hash(body.password, 10);

  await db.insert(users).values({
    name: body.name,
    email: body.email,
    passwordHash,
  });

  return reply.code(201).send({ message: "Usuário criado!" });
}
