import { useState, useCallback, useMemo } from "react";
import { getMonthRange } from "@/lib/domain/calculations";

export function useMonth() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const range = useMemo(() => getMonthRange(year, month), [year, month]);

  const label = useMemo(() => {
    return new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [year, month]);

  const prev = useCallback(() => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }, [month]);

  const next = useCallback(() => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }, [month]);

  const goToToday = useCallback(() => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
  }, []);

  return { year, month, range, label, prev, next, goToToday };
}
