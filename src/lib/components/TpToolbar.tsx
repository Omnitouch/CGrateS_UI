import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Box, Button, TextField } from '@mui/material';
import * as api from '../api';
import SearchableSelect from './SearchableSelect';

export const errMsg = (e: unknown, fallbackText: string) => (e instanceof Error ? e.message : fallbackText);
export const isNotFound = (e: unknown) => e instanceof Error && e.message.includes('NOT_FOUND');

/** TPids, the selected one, and an ID list fetched with the search box (PaginatorWithSearch). */
export function useTpIdList(
  baseUrl: string | null,
  fetchIds: (baseUrl: string, tpid: string, search?: string) => Promise<string[] | null>,
) {
  const [tpids, setTpids] = useState<string[]>([]);
  const [tpid, setTpid] = useState('');
  const [search, setSearch] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!baseUrl) return;
    api.getTPIds(baseUrl).then(r => setTpids(r || [])).catch(e => setError(errMsg(e, 'Failed to load tariff plans')));
  }, [baseUrl]);

  const refresh = useCallback(async () => {
    if (!baseUrl || !tpid) return;
    setLoading(true);
    setError(null);
    try {
      setIds((await fetchIds(baseUrl, tpid, search.trim() || undefined)) || []);
    } catch (e: unknown) {
      setIds([]);
      if (!isNotFound(e)) setError(errMsg(e, 'Failed to fetch'));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, tpid, search, fetchIds]);

  useEffect(() => { setIds([]); refresh(); }, [tpid]); // eslint-disable-line react-hooks/exhaustive-deps

  return { tpids, tpid, setTpid, search, setSearch, ids, loading, error, setError, refresh };
}

interface TpToolbarProps {
  tpids: string[];
  tpid: string;
  onTpid: (v: string) => void;
  search: string;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  children?: ReactNode;
}

export default function TpToolbar({ tpids, tpid, onTpid, search, onSearch, onRefresh, children }: TpToolbarProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <SearchableSelect label="TPID" value={tpid} options={tpids} onChange={onTpid} disableClearable sx={{ minWidth: 220 }} />
      <TextField size="small" label="Search ID" value={search} onChange={e => onSearch(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onRefresh(); }} />
      <Button variant="contained" onClick={onRefresh} disabled={!tpid}>Search</Button>
      {children}
    </Box>
  );
}
