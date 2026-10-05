import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { Role } from "@/lib/domain/types";
import { withTransaction } from "@/lib/data/mysql/pool";
import { writeAudit, type UserRow } from "@/lib/data/mysql/rows";

const LINK_TTL_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function findUser(pool: Pool, id: string) {
  const [rows] = await pool.query<UserRow[]>("SELECT id, email, role FROM users WHERE id = ?", [
    id,
  ]);
  const user = rows[0];
  return user ? { id: user.id, email: user.email, role: user.role } : null;
}

export async function createMagicLink(
  pool: Pool,
  input: { email: string; tokenHash: string },
  now: Date,
) {
  const email = input.email.trim().toLowerCase();
  await pool.query("DELETE FROM magic_links WHERE expires_at < ? LIMIT 200", [
    new Date(now.getTime() - DAY_MS),
  ]);
  await pool.query(
    "INSERT INTO magic_links (token_hash, email, expires_at, used_at, created_at) VALUES (?, ?, ?, NULL, ?)",
    [input.tokenHash, email, new Date(now.getTime() + LINK_TTL_MS), now],
  );
  return { email };
}

/** Use a sign-in link once. The first sign-in creates a fan account. */
export async function consumeMagicLink(pool: Pool, tokenHash: string, now: Date) {
  return withTransaction(pool, async (connection) => {
    const [links] = await connection.query<RowDataPacket[]>(
      "SELECT email, expires_at, used_at FROM magic_links WHERE token_hash = ? FOR UPDATE",
      [tokenHash],
    );
    const link = links[0];
    if (!link || link.used_at || (link.expires_at as Date).getTime() < now.getTime()) {
      return {
        ok: false as const,
        errors: { form: "This sign-in link is invalid or has expired." },
      };
    }
    await connection.query("UPDATE magic_links SET used_at = ? WHERE token_hash = ?", [
      now,
      tokenHash,
    ]);
    const email = String(link.email);
    await connection.query(
      "INSERT IGNORE INTO users (id, email, role, display_name, created_at) VALUES (?, ?, 'fan', ?, ?)",
      [randomUUID(), email, email.split("@")[0] || "Fan", now],
    );
    const [users] = await connection.query<UserRow[]>(
      "SELECT id, email, role FROM users WHERE email = ?",
      [email],
    );
    const user = users[0]!;
    await writeAudit(
      connection,
      {
        actorId: user.id,
        actorEmail: user.email,
        action: "auth.sign_in",
        entityType: "user",
        entityId: user.id,
        before: null,
        after: { role: user.role },
      },
      now,
    );
    return {
      ok: true as const,
      result: { email: user.email, role: user.role, userId: user.id },
    };
  });
}

/** Create the account if needed and set its role. For the first admin and other operator tasks. */
export async function upsertUserRole(pool: Pool, emailInput: string, role: Role, now: Date) {
  const email = emailInput.trim().toLowerCase();
  await pool.query(
    `INSERT INTO users (id, email, role, display_name, created_at) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = ?`,
    [randomUUID(), email, role, email.split("@")[0] || "Fan", now, role],
  );
  const [rows] = await pool.query<UserRow[]>("SELECT id, email, role FROM users WHERE email = ?", [
    email,
  ]);
  return rows[0]!;
}

/** Count a hit against key in a window shared by every app instance. */
export async function rateLimitHit(
  pool: Pool,
  keyHash: string,
  limit: number,
  windowMs: number,
  now: Date,
) {
  return withTransaction(pool, async (connection) => {
    const reset = new Date(now.getTime() + windowMs);
    // hits is assigned first, so both IFs read the stored reset_at.
    await connection.query(
      `INSERT INTO rate_limits (key_hash, hits, reset_at) VALUES (?, 1, ?)
       ON DUPLICATE KEY UPDATE
         hits = IF(reset_at <= ?, 1, hits + 1),
         reset_at = IF(reset_at <= ?, ?, reset_at)`,
      [keyHash, reset, now, now, reset],
    );
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT hits, reset_at FROM rate_limits WHERE key_hash = ?",
      [keyHash],
    );
    await connection.query("DELETE FROM rate_limits WHERE reset_at < ? LIMIT 20", [
      new Date(now.getTime() - DAY_MS),
    ]);
    const hits = Number(rows[0]?.hits ?? 1);
    const resetAt = (rows[0]?.reset_at as Date | undefined)?.getTime() ?? reset.getTime();
    const ok = hits <= limit;
    return { ok, retryAfterMs: ok ? 0 : Math.max(0, resetAt - now.getTime()) };
  });
}
