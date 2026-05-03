import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, TextField, CircularProgress, Alert, Chip,
  Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useOcsBaseUrl } from '../OcsContext';
import * as api from '../api';

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

function getJsonErrorPosition(jsonStr: string, errorMsg: string): { line: number; col: number } | null {
  const posMatch = errorMsg.match(/position\s+(\d+)/i);
  if (!posMatch) return null;
  const pos = parseInt(posMatch[1], 10);
  const before = jsonStr.substring(0, pos);
  const line = (before.match(/\n/g) || []).length + 1;
  const lastNewline = before.lastIndexOf('\n');
  const col = pos - (lastNewline === -1 ? 0 : lastNewline);
  return { line, col };
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
  const [parseError, setParseError] = useState<{ message: string; line: number; col: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = useCallback(() => {
    try {
      setRequestText(JSON.stringify(JSON.parse(requestText), null, 2));
      setError(null);
      setParseError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      setError(msg);
      const pos = getJsonErrorPosition(requestText, msg);
      setParseError(pos ? { message: msg, ...pos } : null);
    }
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
    setParseError(null);
    setResponseText('');
    setStatusCode(null);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(requestText);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      setError(msg);
      const pos = getJsonErrorPosition(requestText, msg);
      setParseError(pos ? { message: msg, ...pos } : null);
      setLoading(false);
      return;
    }
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
      setExecTime(((Date.now() - start) / 1000).toFixed(3));
      addToHistory(requestText);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setExecTime(((Date.now() - start) / 1000).toFixed(3));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, requestText, addToHistory]);

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

  const jumpToError = useCallback(() => {
    if (!parseError || !textareaRef.current) return;
    const lines = requestText.split('\n');
    let pos = 0;
    for (let i = 0; i < parseError.line - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1;
    }
    pos += parseError.col - 1;
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos);
  }, [parseError, requestText]);

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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Endpoint: {baseUrl}/jsonrpc
        {execTime && <Chip label={`${execTime}s`} size="small" sx={{ ml: 1 }} />}
        {statusCode !== null && <Chip label={`HTTP ${statusCode}`} size="small" color={statusColor} sx={{ ml: 1 }} />}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => { setError(null); setParseError(null); }}>
          {error}
          {parseError && (
            <Button size="small" sx={{ ml: 1 }} onClick={jumpToError}>
              Jump to error (Line {parseError.line}, Col {parseError.col})
            </Button>
          )}
        </Alert>
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
          onChange={e => { setRequestText(e.target.value); setParseError(null); }}
          onSelect={handleCursorChange}
          onKeyUp={handleCursorChange}
          onClick={handleCursorChange}
          inputRef={textareaRef}
          sx={{ fontFamily: 'monospace', mb: 1 }}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={handleFormat}>Format</Button>
          <Button variant="contained" onClick={handleSend} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Send'}
          </Button>
        </Box>
      </Paper>

      {responseText && (
        <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
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
