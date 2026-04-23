import { z } from "zod";

export const LoginInput = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const RegisterInput = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(80),
});
export type RegisterInput = z.infer<typeof RegisterInput>;
