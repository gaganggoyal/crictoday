export type DataMode = "mysql" | "supabase" | "demo" | "unconfigured";

export function dataMode(): DataMode {
  if (process.env.DATABASE_URL?.startsWith("mysql://")) return "mysql";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "supabase";
  }
  if (process.env.ALLOW_DEMO_DATA === "true") return "demo";
  if (process.env.ALLOW_DEMO_DATA === "false") return "unconfigured";
  if (process.env.NODE_ENV !== "production") return "demo";
  return "unconfigured";
}

/** MySQL and Supabase keep their data in a database; demo mode uses the local JSON store. */
export function usesDatabase() {
  const mode = dataMode();
  return mode === "mysql" || mode === "supabase";
}

/** The demo role addresses (admin@cricketmatch.today and so on) work only on the local demo store. */
export function demoRolesAllowed() {
  return dataMode() === "demo" && process.env.NODE_ENV !== "production";
}

/** Outside production, show sign-in and alert links on the page as well as emailing them. */
export function devInboxAllowed() {
  const mode = dataMode();
  return (mode === "demo" || mode === "mysql") && process.env.NODE_ENV !== "production";
}
