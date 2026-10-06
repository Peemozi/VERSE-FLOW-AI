import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "../../src/main/database/migrations";

describe("migrations", () => {
  it("has an initial schema migration", () => {
    expect(MIGRATIONS[0]?.id).toBe("001_initial");
    expect(MIGRATIONS[0]?.sql).toContain("bible_verses");
    expect(MIGRATIONS[0]?.sql).toContain("detections");
  });
});
