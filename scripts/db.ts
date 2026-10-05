import { existsSync } from "node:fs";
import { upsertUserRole } from "@/lib/data/mysql/auth";
import { removeDemo, seedDemo } from "@/lib/data/mysql/demo";
import { migrate } from "@/lib/data/mysql/migrate";
import { createPool } from "@/lib/data/mysql/pool";
import type { Role } from "@/lib/domain/types";

const ROLES: Role[] = ["fan", "academy_owner", "organiser", "moderator", "admin"];

const USAGE = `Usage: pnpm db <command>

  migrate                   apply db/mysql/*.sql that have not run yet
  seed-demo                 load the labelled DEMO catalogue (existing rows are kept)
  remove-demo               delete every DEMO match and academy
  set-role <email> <role>   create the account if needed and set its role
                            roles: ${ROLES.join(", ")}

Reads DATABASE_URL (mysql://user:password@host:3306/database) from the
environment, then .env.local, then .env.`;

// Earlier files win: loadEnvFile never replaces a variable that is already set.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "help") {
    console.log(USAGE);
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("mysql://")) throw new Error("DATABASE_URL must be a mysql:// URL.");

  if (command === "migrate") {
    await migrate(url);
    console.log("Schema is up to date.");
    return;
  }

  const pool = createPool(url);
  try {
    if (command === "seed-demo") {
      const added = await seedDemo(pool, new Date());
      console.log(`Added ${added.matches} DEMO matches and ${added.academies} DEMO academies.`);
    } else if (command === "remove-demo") {
      const removed = await removeDemo(pool);
      console.log(
        `Removed ${removed.matches} DEMO matches and ${removed.academies} DEMO academies.`,
      );
    } else if (command === "set-role") {
      const [email, role] = args;
      if (!email?.includes("@") || !ROLES.includes(role as Role)) {
        throw new Error(`Usage: pnpm db set-role <email> <${ROLES.join("|")}>`);
      }
      const user = await upsertUserRole(pool, email, role as Role, new Date());
      console.log(`${user.email} is ${user.role}.`);
    } else {
      throw new Error(`Unknown command "${command}".\n\n${USAGE}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
