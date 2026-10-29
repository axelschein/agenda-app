import type { UserRole } from "./roles.js";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  email: string;
  role: UserRole;
  /** Present only for a professional account linked to one peluquero profile. */
  peluqueroId?: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
}
