export type DataMode = "supabase" | "demo" | "unconfigured";

export function dataMode(): DataMode {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "supabase";
  }
  if (process.env.ALLOW_DEMO_DATA === "true") return "demo";
  if (process.env.ALLOW_DEMO_DATA === "false") return "unconfigured";
  if (process.env.NODE_ENV !== "production") return "demo";
  return "unconfigured";
}

export function demoRolesAllowed() {
  return dataMode() === "demo" && process.env.NODE_ENV !== "production";
}
