import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function secret() {
  const key = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (key) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY is required in production.");
  }
  return "dev-only-key-not-for-production";
}

function keyBytes() {
  return createHash("sha256").update(secret()).digest();
}

export function hashEmail(email: string) {
  return createHmac("sha256", keyBytes()).update(email.trim().toLowerCase()).digest("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function encryptString(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptString(payload: string) {
  const [ivPart, tagPart, body] = payload.split(".");
  if (!ivPart || !tagPart || !body) throw new Error("Invalid ciphertext.");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]);
  return plain.toString("utf8");
}

export function signPayload(payload: string) {
  return createHmac("sha256", keyBytes()).update(payload).digest("base64url");
}

export function verifyPayload(payload: string, signature: string) {
  const expected = signPayload(payload);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function timingSafeEqual(left: Buffer, right: Buffer) {
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index]! ^ right[index]!;
  }
  return diff === 0;
}
