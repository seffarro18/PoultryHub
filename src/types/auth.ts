export type UserRole = "Super Admin" | "Farm Admin" | "Manager" | "Staff";

export type AccountStatus = "pending" | "active" | "disabled";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  /** Which farm this account belongs to — null for Super Admin and for a not-yet-assigned Farm Admin/Manager/Staff. */
  farmId: string | null;
  avatar?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthTokens {
  token: string;
  refreshToken: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  user: User;
}

export type AuthError =
  | "invalid_credentials"
  | "account_disabled"
  | "network_error"
  | "server_error"
  | "session_expired"
  | "email_not_confirmed"
  | "email_taken";

export interface LoginState {
  isLoading: boolean;
  error: AuthError | null;
  errorMessage: string | null;
}
