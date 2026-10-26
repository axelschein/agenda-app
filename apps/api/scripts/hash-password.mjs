import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

const terminal = createInterface({ input: process.stdin, output: process.stdout });
const password = await terminal.question("Contraseña para la cuenta permitida: ");
terminal.close();

if (password.length < 12) {
  console.error("Usá una contraseña de al menos 12 caracteres.");
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  console.log(`scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
}
