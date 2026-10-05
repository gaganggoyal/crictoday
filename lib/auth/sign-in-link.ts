import "server-only";
import { appendOutbox, consumeMagicLink } from "@/lib/domain/workflows";
import { readStore, writeStore } from "@/lib/data/store";
import { dataMode } from "@/lib/data/mode";
import { consumeMagicLink as consumeMysqlMagicLink } from "@/lib/data/mysql/auth";
import { mysqlPool } from "@/lib/data/mysql/pool";
import { hashToken } from "@/lib/security/crypto";
import type { Role } from "@/lib/domain/types";

export type SignInResult =
  | { ok: true; result: { email: string; role: Role; userId: string } }
  | { ok: false; errors: Record<string, string> };

/** Use an emailed sign-in link once. MySQL and the demo store keep their own links. */
export async function consumeSignInLink(token: string): Promise<SignInResult> {
  const mode = dataMode();
  if (mode === "mysql") return consumeMysqlMagicLink(mysqlPool(), hashToken(token), new Date());
  if (mode !== "demo") {
    return {
      ok: false,
      errors: { form: "Use the link in your email. This page is for the local demo inbox." },
    };
  }
  const result = consumeMagicLink(readStore(), hashToken(token), new Date());
  if (result.ok) writeStore(appendOutbox(result.store, result.emails, new Date()));
  else if (result.store) writeStore(result.store);
  return result;
}
