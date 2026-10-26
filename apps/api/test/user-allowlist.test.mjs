import "reflect-metadata";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import test from "node:test";
import { UserAllowlistService } from "../dist/modules/auth/infrastructure/user-allowlist.service.js";

const password = "CorrectPassword123!";
const salt = Buffer.alloc(16, 7);
const encodedSalt = salt.toString("base64url");
const encodedHash = scryptSync(password, salt, 64).toString("base64url");
const validHash = `scrypt$${encodedSalt}$${encodedHash}`;

function serviceWithHash(passwordHash) {
  const previous = process.env.AUTH_USERS_JSON;
  process.env.AUTH_USERS_JSON = JSON.stringify([{ email: "admin@example.com", role: "ADMIN", passwordHash }]);
  try {
    return new UserAllowlistService();
  } finally {
    if (previous === undefined) delete process.env.AUTH_USERS_JSON;
    else process.env.AUTH_USERS_JSON = previous;
  }
}

test("rechaza hashes scrypt malformados al cargar la lista permitida", () => {
  const malformed = [
    `scrypt$${encodedSalt}$${"!".repeat(32)}`,
    `scrypt$${encodedSalt}$${Buffer.alloc(32, 1).toString("base64url")}`,
    `scrypt$${Buffer.alloc(8, 1).toString("base64url")}$${encodedHash}`,
    `${validHash}$extra`,
    `scrypt$${encodedSalt}`,
  ];

  for (const passwordHash of malformed) {
    assert.throws(() => serviceWithHash(passwordHash), /passwordHash scrypt válidos/);
  }
});

test("acepta un hash válido y distingue la contraseña correcta", async () => {
  const service = serviceWithHash(validHash);
  assert.deepEqual(await service.authenticate({ email: "admin@example.com", password }), {
    email: "admin@example.com",
    role: "ADMIN",
  });
  assert.equal(await service.authenticate({ email: "admin@example.com", password: "WrongPassword123!" }), null);
});
