"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "./api";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

const CACHE_TTL = 30_000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T, ttl = CACHE_TTL) {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

interface UseApiResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
}

export function useApi<T = unknown>(
  url: string,
  options?: { ttl?: number; enabled?: boolean },
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const enabled = options?.enabled !== false;

  const urlRef = useRef(url);

  const fetchData = useCallback(async () => {
    const currentUrl = urlRef.current;
    if (!enabled || !currentUrl) return;

    const cached = getCached<T>(currentUrl);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    if (pendingRequests.has(currentUrl)) {
      try {
        const result = await pendingRequests.get(currentUrl);
        setData(result as T);
      } catch (e) {
        setError(e as Error);
      }
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const promise = (async () => {
      const res = await apiFetch(currentUrl);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      return res.json();
    })();

    pendingRequests.set(currentUrl, promise);

    try {
      const result = await promise;
      if (!controller.signal.aborted) {
        setCache(currentUrl, result);
        setData(result as T);
        setError(null);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e as Error);
      }
    } finally {
      pendingRequests.delete(currentUrl);
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    fetchData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchData]);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  return { data, error, loading, refetch: fetchData };
}
