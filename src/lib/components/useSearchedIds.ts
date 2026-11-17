import { useEffect, useState } from 'react';
import { isNotFound } from '../api';

/** Runs load(search) after typing pauses; NOT_FOUND counts as an empty list. ids is null until the first answer. */
export function useSearchedIds<T>(load: ((search: string) => Promise<T[] | null>) | null, search: string, reloadKey: unknown) {
  const [ids, setIds] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!load) return;
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await load(search.trim());
        if (live) setIds(r || []);
      } catch (e) {
        if (!live) return;
        setIds([]);
        if (!isNotFound(e)) setError(e instanceof Error ? e.message : 'Failed to fetch');
      } finally {
        if (live) setLoading(false);
      }
    }, search ? 350 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [load, search, reloadKey, tick]);

  return { ids, loading, error, setError, reload: () => setTick(t => t + 1) };
}
