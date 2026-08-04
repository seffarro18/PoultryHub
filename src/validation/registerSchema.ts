import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Full name is required")
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name must not exceed 80 characters")
      .transform((v) => v.trim()),
    email: z
      .string()
      .min(1, "Email address is required")
      .email("Please enter a valid email address")
      .transform((v) => v.trim().toLowerCase()),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must not exceed 64 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    role: z.enum(["Farm Admin", "Manager", "Staff"], {
      message: "Please select a role",
    }),
    agreeToTerms: z
      .boolean()
      .refine((v) => v === true, "You must accept the terms to continue"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormData = z.input<typeof registerSchema>;
export type RegisterFormOutput = z.output<typeof registerSchema>;
