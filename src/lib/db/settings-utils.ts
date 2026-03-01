export const DEFAULT_APP_SETTINGS: Record<string, string> = {
  portfolio_enabled: "false",
  auto_update_enabled: "false",
  auto_update_last_checked_at: "",
};

export function parseBooleanSetting(value: string | null, defaultValue: boolean): boolean {
  if (value === null || value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return defaultValue;
}

export function getMissingDefaultSettings(existingKeys: string[]): Array<{ key: string; value: string }> {
  const existing = new Set(existingKeys);
  return Object.entries(DEFAULT_APP_SETTINGS)
    .filter(([key]) => !existing.has(key))
    .map(([key, value]) => ({ key, value }));
}
