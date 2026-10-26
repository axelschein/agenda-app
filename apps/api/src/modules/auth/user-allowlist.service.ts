import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { USER_ROLES, type AuthenticatedUser, type LoginCredentials, type UserRole } from "@agenda-app/shared";
import { scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

interface AllowedUser extends AuthenticatedUser {
  passwordHash: string;
}

@Injectable()
export class UserAllowlistService {
  private readonly users: AllowedUser[];

  constructor() {
    this.users = this.loadUsers(process.env.AUTH_USERS_JSON ?? "[]");
  }

  async authenticate(credentials: LoginCredentials): Promise<AuthenticatedUser | null> {
    const email = credentials.email.trim().toLowerCase();
    const user = this.users.find((candidate) => candidate.email === email);
    if (!user) {
      await scryptAsync(credentials.password, "agenda-app-unknown-account-salt", 64);
      return null;
    }
    if (!(await verifyPassword(credentials.password, user.passwordHash))) return null;
    return { email: user.email, role: user.role };
  }

  isAllowed(user: AuthenticatedUser): boolean {
    return this.users.some((candidate) => candidate.email === user.email && candidate.role === user.role);
  }

  private loadUsers(value: string): AllowedUser[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new InternalServerErrorException("AUTH_USERS_JSON debe contener un JSON válido.");
    }
    if (!Array.isArray(parsed)) {
      throw new InternalServerErrorException("AUTH_USERS_JSON debe ser una lista de usuarios.");
    }

    const emails = new Set<string>();
    return parsed.map((entry: unknown) => {
      if (!entry || typeof entry !== "object") {
        throw new InternalServerErrorException("Cada cuenta permitida debe ser un objeto válido.");
      }
      const candidate = entry as Record<string, unknown>;
      const email = typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : "";
      const role = candidate.role;
      const passwordHash = candidate.passwordHash;
      if (!email.includes("@") || typeof passwordHash !== "string" || !isPasswordHash(passwordHash)) {
        throw new InternalServerErrorException("Cada cuenta permitida requiere email y passwordHash scrypt válidos.");
      }
      if (typeof role !== "string" || !USER_ROLES.includes(role as UserRole)) {
        throw new InternalServerErrorException("El rol de la cuenta debe ser ADMIN o CLIENT.");
      }
      if (emails.has(email)) {
        throw new InternalServerErrorException("AUTH_USERS_JSON no puede repetir direcciones de correo.");
      }
      emails.add(email);
      return { email, role: role as UserRole, passwordHash };
    });
  }
}

function isPasswordHash(value: string): boolean {
  const [algorithm, salt, hash] = value.split("$");
  return algorithm === "scrypt" && typeof salt === "string" && salt.length >= 16 && typeof hash === "string" && hash.length >= 32;
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [, salt, hash] = encodedHash.split("$");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = (await scryptAsync(password, Buffer.from(salt, "base64url"), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
