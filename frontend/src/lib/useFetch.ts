"use client";

/**
 * Tiny data-fetching hook used by every page that reads from the API.
 *
 * - Re-runs whenever `deps` change (page, search, id...).
 * - `loading` is derived (does the stored result belong to the current deps?)
 *   rather than set in an effect, which keeps React's compiler lint happy and
 *   avoids an extra render.
 * - Keeps the previous data visible while re-fetching so lists don't flash.
 * - `reload()` forces a refetch; `setData()` lets callers patch results in
 *   place after a mutation (e.g. mark a booking cancelled).
 */
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "./api";

interface Result<T> {
  key: string;
  data: T | null;
  error: string | null;
  status: number | null;
}

export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([tick, ...deps]);
  const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: null, status: null });

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null, status: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Something went wrong";
        const status = err instanceof ApiError ? err.status : null;
        setResult((prev) => ({ key, data: prev.data, error: message, status }));
      });
    return () => {
      cancelled = true;
    };
    // `fetcher` is intentionally excluded: it closes over the same values as `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = result.key !== key;
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback(
    (updater: (prev: T | null) => T | null) => setResult((r) => ({ ...r, data: updater(r.data) })),
    [],
  );

  return {
    data: result.data,
    error: loading ? null : result.error,
    errorStatus: loading ? null : result.status,
    loading,
    reload,
    setData,
  };
}
