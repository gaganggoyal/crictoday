import mysql, { type Pool, type PoolConnection } from "mysql2/promise";

/** A failure the visitor or moderator can act on. Thrown inside a transaction, it rolls back. */
export class DomainError extends Error {
  constructor(public errors: Record<string, string>) {
    super(Object.values(errors)[0] ?? "Rejected.");
    this.name = "DomainError";
  }
}

export function createPool(url: string): Pool {
  return mysql.createPool({
    uri: url,
    connectionLimit: 10,
    // DATETIME columns hold UTC. Dates go in and come out as UTC.
    timezone: "Z",
    decimalNumbers: true,
    supportBigNumbers: true,
  });
}

const globalForPool = globalThis as unknown as { cricketmatchPool?: Pool };

/** One pool per process, kept across dev reloads. */
export function mysqlPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("mysql://")) throw new Error("DATABASE_URL must be a mysql:// URL.");
  globalForPool.cricketmatchPool ??= createPool(url);
  return globalForPool.cricketmatchPool;
}

export async function withTransaction<T>(
  pool: Pool,
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
