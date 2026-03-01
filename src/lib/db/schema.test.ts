import { describe, expect, it } from "vitest";
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from "./schema";

describe("schema migrations", () => {
  it("uses numbered, strictly increasing migration versions", () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0);
    const versions = MIGRATIONS.map((migration) => migration.version);
    for (let i = 1; i < versions.length; i += 1) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1] ?? 0);
    }
    expect(LATEST_SCHEMA_VERSION).toBe(versions[versions.length - 1]);
  });

  it("contains app_settings migration for feature flags", () => {
    const appSettingsMigration = MIGRATIONS.find((migration) =>
      migration.statements.some((statement) => statement.toLowerCase().includes("create table if not exists app_settings"))
    );
    expect(appSettingsMigration).toBeDefined();
  });
});
