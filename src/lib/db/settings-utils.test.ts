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
  it("includes portfolio_enabled=false when missing", () => {
    const missing = getMissingDefaultSettings([]);
    expect(missing).toContainEqual({ key: "portfolio_enabled", value: "false" });
  });

  it("does not include settings that already exist", () => {
    const missing = getMissingDefaultSettings(["portfolio_enabled"]);
    expect(missing).toHaveLength(0);
  });
});
