import { create } from "zustand";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cache: Map<string, CacheEntry<any>>;
  set: <T>(key: string, data: T, ttl?: number) => void;
  get: <T>(key: string) => T | null;
  has: (key: string) => boolean;
  clear: (key?: string) => void;
  cleanup: () => void;
}

export const useGlobalCache = create<CacheState>()((set, get) => ({
  cache: new Map(),

  set: <T>(key: string, data: T, ttl: number = 5 * 60 * 1000) => {
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      });
      return { cache: newCache };
    });
  },

  get: <T>(key: string): T | null => {
    const state = get();
    const entry = state.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      // Remove expired entry
      set((currentState) => {
        const newCache = new Map(currentState.cache);
        newCache.delete(key);
        return { cache: newCache };
      });
      return null;
    }

    return entry.data as T;
  },

  has: (key: string) => {
    const state = get();
    const entry = state.cache.get(key);

    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      // Remove expired entry
      set((currentState) => {
        const newCache = new Map(currentState.cache);
        newCache.delete(key);
        return { cache: newCache };
      });
      return false;
    }

    return true;
  },

  clear: (key?: string) => {
    set((state) => {
      if (key) {
        const newCache = new Map(state.cache);
        newCache.delete(key);
        return { cache: newCache };
      } else {
        return { cache: new Map() };
      }
    });
  },

  cleanup: () => {
    set((state) => {
      const newCache = new Map();
      const now = Date.now();

      state.cache.forEach((entry, key) => {
        if (now - entry.timestamp <= entry.ttl) {
          newCache.set(key, entry);
        }
      });

      return { cache: newCache };
    });
  },
}));
