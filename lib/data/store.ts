import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emptyStore } from "@/lib/domain/workflows";
import type { StoreShape } from "@/lib/domain/types";

const filePath = path.join(process.cwd(), ".data", "store.json");

export function readStore(): StoreShape {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<StoreShape>;
    return { ...emptyStore(), ...parsed, version: 1 };
  } catch {
    return emptyStore();
  }
}

export function writeStore(store: StoreShape) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  writeFileSync(temporary, JSON.stringify(store));
  renameSync(temporary, filePath);
}
