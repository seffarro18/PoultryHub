export interface SecuritySettings {
  minPasswordLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  mfaEnabled: boolean;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  updatedAt: string;
}

export type SecuritySettingsInput = Omit<SecuritySettings, "updatedAt">;

export type LoginStatus = "success" | "failed";

export interface LoginHistoryEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userAgent: string | null;
  status: LoginStatus;
  device: string;
  browser: string;
  operatingSystem: string;
  createdAt: string;
}

export interface FailedLoginAttempt {
  id: string;
  email: string;
  userAgent: string | null;
  createdAt: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export interface LoginAllowedResult {
  allowed: boolean;
  retryAfterSeconds: number;
}
