import { describe, it, expect } from "@jest/globals";
import { scryptSync } from "node:crypto";
import { UserAllowlistService } from "../../src/modules/auth/infrastructure/user-allowlist.service.js";
const salt = Buffer.alloc(16, 7),
  password = "CorrectPassword123!";
const encodedSalt = salt.toString("base64url"),
  encodedHash = scryptSync(password, salt, 64).toString("base64url");
const validHash = ["scrypt", encodedSalt, encodedHash].join("$");
function serviceWithHash(passwordHash: string) {
  const previous = process.env.AUTH_USERS_JSON;
  process.env.AUTH_USERS_JSON = JSON.stringify([
    { email: "admin@example.com", role: "ADMIN", passwordHash },
  ]);
  try {
    return new UserAllowlistService();
  } finally {
    if (previous === undefined) delete process.env.AUTH_USERS_JSON;
    else process.env.AUTH_USERS_JSON = previous;
  }
}
describe("UserAllowlistService", () => {
  it.each([
    ["scrypt", encodedSalt, "!".repeat(32)].join("$"),
    ["scrypt", encodedSalt, Buffer.alloc(32, 1).toString("base64url")].join(
      "$",
    ),
    ["scrypt", Buffer.alloc(8, 1).toString("base64url"), encodedHash].join("$"),
    validHash + "$extra",
    ["scrypt", encodedSalt].join("$"),
  ])("rechaza un hash malformado: %s", (hash) => {
    expect(() => serviceWithHash(hash)).toThrow("passwordHash scrypt válidos");
  });
  it("autentica una cuenta válida y rechaza una contraseña incorrecta", async () => {
    const service = serviceWithHash(validHash);
    await expect(
      service.authenticate({ email: "admin@example.com", password }),
    ).resolves.toEqual({ email: "admin@example.com", role: "ADMIN" });
    await expect(
      service.authenticate({
        email: "admin@example.com",
        password: "incorrecta",
      }),
    ).resolves.toBeNull();
  });
});
