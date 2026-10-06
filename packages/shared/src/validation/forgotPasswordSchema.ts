import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email address is required")
    .email("Please enter a valid email address")
    .transform((val) => val.trim().toLowerCase()),
});

export type ForgotPasswordFormData = z.input<typeof forgotPasswordSchema>;
export type ForgotPasswordFormOutput = z.output<typeof forgotPasswordSchema>;
