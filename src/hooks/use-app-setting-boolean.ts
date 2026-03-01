import { useCallback, useEffect, useState } from "react";
import { getBooleanSetting, setSetting } from "@/lib/db";

export function useAppSettingBoolean(key: string, defaultValue: boolean): [boolean, (next: boolean) => Promise<void>, boolean] {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await getBooleanSetting(key, defaultValue);
        if (!cancelled) setValue(loaded);
      } catch {
        if (!cancelled) setValue(defaultValue);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, defaultValue]);

  const update = useCallback(
    async (next: boolean) => {
      setValue(next);
      await setSetting(key, next ? "true" : "false");
    },
    [key]
  );

  return [value, update, loading];
}
