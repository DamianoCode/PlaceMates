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

export const ForgotPasswordInput = z.object({
  email: z.string().email().max(200),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInput>;

export const ResetPasswordInput = z
  .object({
    password: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Hasła muszą być takie same.",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

export const ChangePasswordInput = z
  .object({
    currentPassword: z.string().min(8).max(200),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Hasła muszą być takie same.",
    path: ["confirmPassword"],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "Nowe hasło musi być różne od aktualnego.",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>;
