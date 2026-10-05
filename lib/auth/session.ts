import "server-only";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/auth/supabase-server";
import { dataMode } from "@/lib/data/mode";
import { findUser } from "@/lib/data/mysql/auth";
import { mysqlPool } from "@/lib/data/mysql/pool";
import { readStore } from "@/lib/data/store";
import type { Role } from "@/lib/domain/types";
import { signPayload, verifyPayload } from "@/lib/security/crypto";

const COOKIE = "cm_session";
const ROLES: Role[] = ["fan", "academy_owner", "organiser", "moderator", "admin"];

export type Session = {
  userId: string;
  email: string;
  role: Role;
  exp: number;
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

async function readCookieSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;
  const body = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!verifyPayload(body, signature)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    if (!isRole(session.role)) return null;
    return session;
  } catch {
    return null;
  }
}

async function readSupabaseSession(): Promise<Session | null> {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const profile = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    userId: data.user.id,
    email: data.user.email || profile.data?.email || "",
    role: isRole(profile.data?.role) ? profile.data.role : "fan",
    exp: Date.now() + 60 * 60 * 1000,
  };
}

export async function getSession(): Promise<Session | null> {
  const mode = dataMode();
  if (mode === "supabase") return readSupabaseSession();
  const session = await readCookieSession();
  if (session && mode === "mysql") {
    // Roles change in the database, so the cookie's copy is only a hint.
    const user = await findUser(mysqlPool(), session.userId);
    return user ? { ...session, email: user.email, role: user.role } : null;
  }
  if (!session || mode !== "demo") return session;
  const user = readStore().users.find((item) => item.id === session.userId);
  if (!user || !isRole(user.role)) return session;
  return { ...session, email: user.email, role: user.role };
}

export function sessionCookie(input: Omit<Session, "exp">) {
  const session: Session = { ...input, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return {
    name: COOKIE,
    value: `${body}.${signPayload(body)}`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    },
  };
}

export async function setSession(input: Omit<Session, "exp">) {
  const cookie = sessionCookie(input);
  const jar = await cookies();
  jar.set(cookie.name, cookie.value, cookie.options);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function isStaff(role: Role) {
  return role === "admin" || role === "moderator";
}
