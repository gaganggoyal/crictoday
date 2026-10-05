import { consumeSignInLink } from "@/lib/auth/sign-in-link";
import { sessionCookie } from "@/lib/auth/session";
import { redirectOnSameHost } from "@/lib/http/redirect";
import { safeNextPath } from "@/lib/utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const next = safeNextPath(url.searchParams.get("next"));
  if (!token) return redirectOnSameHost("/login?error=link");
  const result = await consumeSignInLink(token);
  if (!result.ok) return redirectOnSameHost("/login?error=link");
  const response = redirectOnSameHost(next);
  const cookie = sessionCookie({
    userId: result.result.userId,
    email: result.result.email,
    role: result.result.role,
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
