import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Chip,
  Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useOcsBaseUrl } from '../OcsContext';
import { diagnose, explainResponseError, type Problem, type ResponseHint } from '../jsonDoctor';

interface HistoryEntry {
  id: number;
  method: string;
  request: string;
  timestamp: number;
}

const HISTORY_KEY = 'cgrates_jsonrpc_history';
const MAX_HISTORY = 50;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export function Component() {
  const baseUrl = useOcsBaseUrl();
  const [requestText, setRequestText] = useState('{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "CoreSv1.Ping",\n  "params": [{}]\n}');
  const [responseText, setResponseText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [execTime, setExecTime] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [selectedHistory, setSelectedHistory] = useState<number | ''>('');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [responseHint, setResponseHint] = useState<ResponseHint | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const diagnosis = useMemo(() => diagnose(requestText), [requestText]);
  const errorCount = diagnosis.problems.filter(p => p.severity === 'error').length;

  const handleFormat = useCallback(() => {
    setRequestText(JSON.stringify(JSON.parse(requestText), null, 2));
  }, [requestText]);

  const addToHistory = useCallback((request: string) => {
    try {
      const parsed = JSON.parse(request);
      const method = parsed.method || 'unknown';
      const entry: HistoryEntry = { id: Date.now(), method, request, timestamp: Date.now() };
      const updated = [entry, ...history.filter(h => h.request !== request)].slice(0, MAX_HISTORY);
      setHistory(updated);
      saveHistory(updated);
    } catch { /* ignore */ }
  }, [history]);

  const handleSend = useCallback(async () => {
    if (!baseUrl) return;
    setLoading(true);
    setError(null);
    setResponseHint(null);
    setResponseText('');
    setStatusCode(null);
    if (errorCount > 0) {
      setError(`Fix the ${errorCount} problem${errorCount > 1 ? 's' : ''} listed under the request before sending.`);
      setLoading(false);
      return;
    }
    const payload = JSON.parse(requestText);
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl}/jsonrpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setStatusCode(res.status);
      const data = await res.json();
      setResponseText(JSON.stringify(data, null, 2));
      if (typeof data?.error === 'string' && data.error) {
        setResponseHint(explainResponseError(data.error, requestText));
      }
      setExecTime(((Date.now() - start) / 1000).toFixed(3));
      addToHistory(requestText);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setExecTime(((Date.now() - start) / 1000).toFixed(3));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, requestText, addToHistory, errorCount]);

  const handleCursorChange = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.substring(0, pos);
    const line = (before.match(/\n/g) || []).length + 1;
    const lastNewline = before.lastIndexOf('\n');
    const col = pos - (lastNewline === -1 ? 0 : lastNewline);
    setCursorPos({ line, col });
  }, []);

  const selectProblem = useCallback((p: Problem) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(p.offset, p.offset + p.length);
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.scrollTop = Math.max(0, (p.line - 3) * lineHeight);
    handleCursorChange();
  }, [handleCursorChange]);

  const handleHistorySelect = useCallback((id: number | '') => {
    setSelectedHistory(id);
    if (id === '') return;
    const entry = history.find(h => h.id === id);
    if (entry) setRequestText(entry.request);
  }, [history]);

  const deleteHistoryEntry = useCallback((id: number) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
    if (selectedHistory === id) setSelectedHistory('');
  }, [history, selectedHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    setSelectedHistory('');
  }, []);

  const copyResponse = useCallback(() => {
    navigator.clipboard.writeText(responseText);
  }, [responseText]);

  const downloadResponse = useCallback(() => {
    const blob = new Blob([responseText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [responseText]);

  const statusColor = statusCode === null ? undefined : statusCode >= 200 && statusCode < 300 ? 'success' : 'error';

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Execute JSON-RPC</Typography>
      <Typography component="div" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Endpoint: {baseUrl}/jsonrpc
        {execTime && <Chip label={`${execTime}s`} size="small" sx={{ ml: 1 }} />}
        {statusCode !== null && <Chip label={`HTTP ${statusCode}`} size="small" color={statusColor} sx={{ ml: 1 }} />}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}

      {history.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Request History ({history.length})</InputLabel>
              <Select
                value={selectedHistory}
                label={`Request History (${history.length})`}
                onChange={e => handleHistorySelect(e.target.value as number | '')}
              >
                <MenuItem value="">-- Select --</MenuItem>
                {history.map(h => (
                  <MenuItem key={h.id} value={h.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {h.method} - {new Date(h.timestamp).toLocaleString()}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={e => { e.stopPropagation(); deleteHistoryEntry(h.id); }}
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Clear all history">
              <IconButton size="small" color="error" onClick={clearHistory}><DeleteSweepIcon /></IconButton>
            </Tooltip>
          </Box>
        </Paper>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">Request</Typography>
          <Typography variant="caption" color="text.secondary">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </Typography>
        </Box>
        <TextField
          multiline
          fullWidth
          minRows={10}
          value={requestText}
          onChange={e => setRequestText(e.target.value)}
          onSelect={handleCursorChange}
          onKeyUp={handleCursorChange}
          onClick={handleCursorChange}
          inputRef={textareaRef}
          sx={{ mb: 1, '& textarea': { fontFamily: 'monospace' } }}
        />
        {diagnosis.problems.length > 0 && (
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <List dense disablePadding>
              {diagnosis.problems.map((p, i) => (
                <ListItemButton key={i} onClick={() => selectProblem(p)} divider={i < diagnosis.problems.length - 1}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {p.severity === 'error'
                      ? <ErrorOutlineIcon fontSize="small" color="error" />
                      : <WarningAmberIcon fontSize="small" color="warning" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={<><Typography component="span" variant="caption" color="text.secondary" sx={{ mr: 1, fontFamily: 'monospace' }}>Ln {p.line}:{p.col}</Typography>{p.message}</>}
                    secondary={p.hint}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {diagnosis.fixed && (
            <Button variant="outlined" color="warning" startIcon={<AutoFixHighIcon />} onClick={() => setRequestText(diagnosis.fixed!)}>
              Fix it
            </Button>
          )}
          <Button variant="outlined" onClick={handleFormat} disabled={!diagnosis.valid}>Format</Button>
          <Button variant="contained" onClick={handleSend} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Send'}
          </Button>
        </Box>
      </Paper>

      {responseHint && (
        <Alert
          severity="info" sx={{ mb: 2 }}
          action={responseHint.fixed && (
            <Button color="inherit" size="small" startIcon={<AutoFixHighIcon />}
              onClick={() => { setRequestText(responseHint.fixed!); setResponseHint(null); }}>
              {responseHint.fixLabel}
            </Button>
          )}
        >
          {responseHint.message}
        </Alert>
      )}

      {responseText && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Response</Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Copy response">
                <IconButton size="small" onClick={copyResponse}><ContentCopyIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Download response">
                <IconButton size="small" onClick={downloadResponse}><DownloadIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Box>
          </Box>
          <pre style={{ fontSize: 12, margin: 0, maxHeight: 500, overflow: 'auto' }}>{responseText}</pre>
        </Paper>
      )}
    </Box>
  );
}
