import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/utils";

describe("safeNextPath", () => {
  it("keeps same-origin paths with their query and hash", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/admin/submissions?status=pending#top")).toBe(
      "/admin/submissions?status=pending#top",
    );
    expect(safeNextPath("/match/a/../b")).toBe("/match/b");
  });

  it("falls back to the dashboard for anything that could leave the site", () => {
    for (const value of [
      undefined,
      null,
      "",
      "dashboard",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\/evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r\n/evil.example",
      "/\u0000/evil.example",
      " /dashboard",
    ]) {
      expect(safeNextPath(value), JSON.stringify(value)).toBe("/dashboard");
    }
  });

  it("leaves percent-encoded separators on this site", () => {
    expect(safeNextPath("/%09/evil.example")).toBe("/%09/evil.example");
    expect(safeNextPath("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});
