import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email address is required")
    .email("Please enter a valid email address")
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must not exceed 64 characters"),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginFormData = z.input<typeof loginSchema>;
export type LoginFormOutput = z.output<typeof loginSchema>;
