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
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  /** Farm-side self-chosen display name — replaces firstName/middleName/lastName as this person's own edit target; Super Admin never sets this. */
  nickname: string | null;
  /** Maps `profiles.contact_number`. */
  phone: string | null;
  /** Farm-Admin-controlled HR field — never self-editable, see prevent_self_privilege_escalation(). */
  position: string | null;
  /** Farm-Admin-controlled HR field — never self-editable, see prevent_self_privilege_escalation(). */
  assignedHousePen: string | null;
  /** Maps `profiles.created_at` — used for Staff's "Date Joined". */
  joinedAt: string;
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
  | "email_taken"
  | "account_locked";

export interface LoginState {
  isLoading: boolean;
  error: AuthError | null;
  errorMessage: string | null;
}
