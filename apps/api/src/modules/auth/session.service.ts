import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { AuthenticatedUser } from "@agenda-app/shared";
import { createHmac, timingSafeEqual } from "node:crypto";
import { SESSION_TTL_SECONDS } from "./auth.constants.js";
import { AutenticacionControl } from "./autenticacion.control.js";

interface SessionPayload extends AuthenticatedUser {
  expiresAt: number;
}

@Injectable()
export class SessionService {
  private readonly secret: string;

  constructor(private readonly autenticacion: AutenticacionControl) {
    this.secret = process.env.AUTH_SESSION_SECRET ?? "";
    if (this.secret.length < 32) {
      throw new InternalServerErrorException("AUTH_SESSION_SECRET debe tener al menos 32 caracteres.");
    }
  }

  create(user: AuthenticatedUser): string {
    const payload: SessionPayload = {
      ...user,
      expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encodedPayload}.${this.sign(encodedPayload)}`;
  }

  readCookie(cookieHeader: string | undefined): AuthenticatedUser | null {
    const token = cookieHeader
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("agenda_session="))
      ?.slice("agenda_session=".length);
    if (!token) return null;

    const [encodedPayload, signature, extra] = token.split(".");
    if (!encodedPayload || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(encodedPayload), "base64url");
    const received = Buffer.from(signature, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
      const { email, role, expiresAt } = payload;
      if (typeof email !== "string" || typeof role !== "string" || typeof expiresAt !== "number") return null;
      if (expiresAt <= Math.floor(Date.now() / 1000)) return null;
      const user: AuthenticatedUser = { email, role: role as AuthenticatedUser["role"] };
      return this.autenticacion.autorizar(user) ? user : null;
    } catch {
      return null;
    }
  }

  private sign(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("base64url");
  }
}
