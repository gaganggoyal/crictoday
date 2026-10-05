import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/auth/supabase-server";
import { redirectOnSameHost } from "@/lib/http/redirect";
import { safeNextPath } from "@/lib/utils";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const next = safeNextPath(jar.get("cm_next")?.value);
  jar.delete("cm_next");
  const supabase = await supabaseServer();
  if (!supabase) return redirectOnSameHost("/login?error=link");

  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectOnSameHost(next);
  }

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (tokenHash && type && OTP_TYPES.has(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error) return redirectOnSameHost(next);
  }

  return redirectOnSameHost("/login?error=link");
}
