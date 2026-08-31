import { useEffect, useState } from "react";

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  isValid: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue === null) return initialValue;

      const parsedValue: unknown = JSON.parse(storedValue);
      return isValid(parsedValue) ? parsedValue : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private browsing or a locked-down context.
    }
  }, [key, value]);

  return [value, setValue] as const;
}
