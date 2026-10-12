import { useEffect, useState } from "react";

type StorageKind = "local" | "session";

function storage(kind: StorageKind): Storage {
  return kind === "local" ? window.localStorage : window.sessionStorage;
}

// Storage can be unavailable (private windows, blocked site data), so every access is guarded
// and the app falls back to in-memory state.
export function readStored<T>(kind: StorageKind, key: string, fallback: T): T {
  try {
    const raw = storage(kind).getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(kind: StorageKind, key: string, value: unknown): void {
  try {
    storage(kind).setItem(key, JSON.stringify(value));
  } catch {
    // Keep working from React state.
  }
}

export function usePersistentState<T>(kind: StorageKind, key: string, initial: () => T) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    writeStored(kind, key, value);
  }, [kind, key, value]);
  return [value, setValue] as const;
}
