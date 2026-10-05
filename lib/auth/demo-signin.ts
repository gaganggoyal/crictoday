import "server-only";
import { appendOutbox, consumeMagicLink, type WorkflowResult } from "@/lib/domain/workflows";
import { readStore, writeStore } from "@/lib/data/store";
import { dataMode } from "@/lib/data/mode";
import { hashToken } from "@/lib/security/crypto";
import type { Role } from "@/lib/domain/types";

export function consumeDemoSignIn(token: string): WorkflowResult<{ email: string; role: Role; userId: string }> {
  if (dataMode() !== "demo") {
    return { ok: false, errors: { form: "Use the link in your email. This page is for the local demo inbox." } };
  }
  const result = consumeMagicLink(readStore(), hashToken(token), new Date());
  if (result.ok) writeStore(appendOutbox(result.store, result.emails, new Date()));
  else if (result.store) writeStore(result.store);
  return result;
}
