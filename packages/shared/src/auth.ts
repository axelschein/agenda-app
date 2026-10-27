import type { UserRole } from "./roles.js";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: AuthenticatedUser;
}
