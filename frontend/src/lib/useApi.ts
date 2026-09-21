"use client";

import { useEffect, useState } from "react";
import { ApiError } from "./api";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Small fetch-on-mount hook so pages don't repeat the same loading/error
// boilerplate. `deps` re-runs the fetch (e.g. when a route param or filter
// changes). The caller's variadic deps array can't be spread into a hook's
// dependency list (must be a literal array), so it's fingerprinted into a
// single string and that string is the actual effect dependency.
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    // Synchronous kickoff of the loading state for this fetch cycle, not a
    // cascading update — the actual data arrives asynchronously below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Something went wrong.";
        setState({ data: null, loading: false, error: message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}
