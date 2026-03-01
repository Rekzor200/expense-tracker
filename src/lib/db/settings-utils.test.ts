import { describe, expect, it } from "vitest";
import { getMissingDefaultSettings, parseBooleanSetting } from "./settings-utils";

describe("parseBooleanSetting", () => {
  it("returns default for null or invalid values", () => {
    expect(parseBooleanSetting(null, false)).toBe(false);
    expect(parseBooleanSetting("maybe", true)).toBe(true);
  });

  it("parses truthy and falsy string values", () => {
    expect(parseBooleanSetting("true", false)).toBe(true);
    expect(parseBooleanSetting("1", false)).toBe(true);
    expect(parseBooleanSetting("yes", false)).toBe(true);
    expect(parseBooleanSetting("false", true)).toBe(false);
    expect(parseBooleanSetting("0", true)).toBe(false);
    expect(parseBooleanSetting("off", true)).toBe(false);
  });
});

describe("getMissingDefaultSettings", () => {
  it("includes default settings when missing", () => {
    const missing = getMissingDefaultSettings([]);
    expect(missing).toContainEqual({ key: "portfolio_enabled", value: "false" });
    expect(missing).toContainEqual({ key: "auto_update_enabled", value: "false" });
    expect(missing).toContainEqual({ key: "auto_update_last_checked_at", value: "" });
  });

  it("does not include settings that already exist", () => {
    const missing = getMissingDefaultSettings([
      "portfolio_enabled",
      "auto_update_enabled",
      "auto_update_last_checked_at",
    ]);
    expect(missing).toHaveLength(0);
  });
});
