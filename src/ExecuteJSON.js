// ExecuteJSON.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Card,
  Spinner,
  InputGroup,
  Dropdown,
  DropdownButton,
  Badge,
} from 'react-bootstrap';

const HISTORY_KEY = 'executeJsonHistory';
const HISTORY_LIMIT = 50;

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
}

function pretty(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function makeLabelFromPayload(obj) {
  try {
    const method = obj?.method ?? '(no method)';
    const tenant =
      Array.isArray(obj?.params) && obj.params[0] && typeof obj.params[0] === 'object'
        ? (obj.params[0].Tenant || obj.params[0].tenant || '')
        : '';
    return tenant ? `${method} — ${tenant}` : `${method}`;
  } catch {
    return '(invalid payload)';
  }
}

function nowIso() {
  return new Date().toISOString();
}

/** Convert a string index (0-based) to {line, col} (1-based). */
function indexToLineCol(text, index) {
  const clamped = Math.max(0, Math.min(index ?? 0, text.length));
  let line = 1, col = 1;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) { // '\n'
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

/** Extract "position N" from a native JSON.parse error message. */
function extractErrorPosition(msg) {
  const m = /position\s+(\d+)/i.exec(msg || '');
  return m ? Number(m[1]) : null;
}

/** Return the full line text at a given index. */
function getLineTextAtIndex(text, index) {
  const start = text.lastIndexOf('\n', Math.max(0, index) - 1) + 1;
  const end = text.indexOf('\n', index);
  const lineEnd = end === -1 ? text.length : end;
  return text.slice(start, lineEnd);
}

const ExecuteJSON = ({ cgratesConfig }) => {
  const [requestText, setRequestText] = useState(`{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ApierV1.Ping",
  "params": [{}]
}`);
  const [responseText, setResponseText] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [history, setHistory] = useState(() => loadHistory());
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);

  // caret position state
  const [caretPos, setCaretPos] = useState(0);
  const [caretLineCol, setCaretLineCol] = useState({ line: 1, col: 1 });

  // parse error position/preview
  const [errorPos, setErrorPos] = useState(null); // number | null
  const [errorLineCol, setErrorLineCol] = useState(null); // {line, col} | null
  const [errorLinePreview, setErrorLinePreview] = useState(''); // line text at error

  // robust ref that works across React-Bootstrap versions
  const textareaRef = useRef(null);
  const setTextareaRef = (el) => { textareaRef.current = el; };

  const apiUrl = useMemo(() => `${cgratesConfig.url}/jsonrpc`, [cgratesConfig.url]);

  useEffect(() => {
    if (history.length > HISTORY_LIMIT) {
      const trimmed = history.slice(0, HISTORY_LIMIT);
      setHistory(trimmed);
      saveHistory(trimmed);
    }
  }, [history]);

  useEffect(() => {
    setCaretLineCol(indexToLineCol(requestText, caretPos));
  }, [requestText, caretPos]);

  const validateJSON = () => {
    try {
      const parsed = JSON.parse(requestText);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Root must be an object');
      // clear any previous error metadata if we parse fine
      setError('');
      setErrorPos(null);
      setErrorLineCol(null);
      setErrorLinePreview('');
      return parsed;
    } catch (e) {
      const pos = extractErrorPosition(e.message);
      if (pos !== null) {
        const lc = indexToLineCol(requestText, pos);
        const lineText = getLineTextAtIndex(requestText, pos);
        setErrorPos(pos);
        setErrorLineCol(lc);
        setErrorLinePreview(lineText);
        throw new Error(`Invalid JSON at line ${lc.line}, column ${lc.col} (position ${pos}): ${e.message}`);
      } else {
        setErrorPos(null);
        setErrorLineCol(null);
        setErrorLinePreview('');
        throw new Error(`Invalid JSON: ${e.message}`);
      }
    }
  };

  const handleFormat = () => {
    try {
      const obj = JSON.parse(requestText);
      setRequestText(JSON.stringify(obj, null, 2));
      setError('');
      setErrorPos(null);
      setErrorLineCol(null);
      setErrorLinePreview('');
    } catch (e) {
      const pos = extractErrorPosition(e.message);
      if (pos !== null) {
        const lc = indexToLineCol(requestText, pos);
        const lineText = getLineTextAtIndex(requestText, pos);
        setError(`Cannot format: line ${lc.line}, column ${lc.col} (position ${pos}): ${e.message}`);
        setErrorPos(pos);
        setErrorLineCol(lc);
        setErrorLinePreview(lineText);
      } else {
        setError(`Cannot format: ${e.message}`);
        setErrorPos(null);
        setErrorLineCol(null);
        setErrorLinePreview('');
      }
    }
  };

  const handleSend = async () => {
    setStatus('sending');
    setError('');
    setResponseText('');
    setExecutionTime(null);
    setErrorPos(null);
    setErrorLineCol(null);
    setErrorLinePreview('');

    let payload;
    try {
      payload = validateJSON();
    } catch (e) {
      setStatus('error');
      setError(e.message);
      return;
    }

    const startTime = Date.now();
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const endTime = Date.now();
      const execTime = ((endTime - startTime) / 1000).toFixed(3);
      setExecutionTime(execTime);

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }

      setResponseText(pretty(parsed));
      setStatus(res.ok ? 'done' : 'error');

      const bodyString = JSON.stringify(payload);
      const existingIndex = history.findIndex((h) => h.bodyString === bodyString);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: makeLabelFromPayload(payload),
        bodyString,
        createdAt: nowIso(),
      };

      let newHistory;
      if (existingIndex >= 0) {
        const existing = history[existingIndex];
        const updated = { ...existing, createdAt: nowIso() };
        newHistory = [updated, ...history.slice(0, existingIndex), ...history.slice(existingIndex + 1)];
      } else {
        newHistory = [entry, ...history];
      }
      setHistory(newHistory);
      saveHistory(newHistory);
      setSelectedHistoryId(newHistory[0]?.id ?? null);
    } catch (e) {
      setStatus('error');
      setError(`Request failed: ${e.message}`);
    }
  };

  const handleSelectHistory = (id) => {
    setSelectedHistoryId(id);
    const item = history.find((h) => h.id === id);
    if (item) {
      setRequestText(JSON.stringify(JSON.parse(item.bodyString), null, 2));
      setError('');
      setErrorPos(null);
      setErrorLineCol(null);
      setErrorLinePreview('');
    }
  };

  const handleDeleteHistoryItem = (id) => {
    const filtered = history.filter((h) => h.id !== id);
    setHistory(filtered);
    saveHistory(filtered);
    if (selectedHistoryId === id) {
      setSelectedHistoryId(filtered[0]?.id ?? null);
    }
  };

  const handleClearHistory = () => {
    if (!window.confirm('Clear all history?')) return;
    setHistory([]);
    saveHistory([]);
    setSelectedHistoryId(null);
  };

  const latestStatusBadge = () => {
    if (status === 'sending') return <Badge bg="secondary">Sending…</Badge>;
    if (status === 'done') return <Badge bg="success">Success</Badge>;
    if (status === 'error') return <Badge bg="danger">Error</Badge>;
    return <Badge bg="light" text="dark">Idle</Badge>;
  };

  const handleTextareaCursor = (e) => {
    const pos = e.target.selectionStart || 0;
    setCaretPos(pos);
  };

  const jumpToError = () => {
    const el = textareaRef.current;
    if (!el) return;

    // clamp to current value length in case text changed
    let i = typeof errorPos === 'number' ? errorPos : 0;
    i = Math.max(0, Math.min(i, el.value.length));

    // focus first, then move caret on the next frame for cross-browser reliability
    el.focus();
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(i, i);
      } catch {}
    });

    setCaretPos(i);
  };

  const errorCaretIndicator = (() => {
    if (errorPos === null || !errorLineCol) return null;
    const caretSpaces = ' '.repeat(Math.max(0, errorLineCol.col - 1));
    return (
      <pre className="mb-0 mt-2 p-2 bg-light border rounded" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
{errorLinePreview}
{caretSpaces}^
      </pre>
    );
  })();

  return (
    <Container fluid className="py-4">
      <Row>
        <Col md={9}>
          <h2>Execute JSON</h2>
          <div className="text-muted mb-3">
            Endpoint:&nbsp;<code>{apiUrl}</code> &nbsp; {latestStatusBadge()}
            {executionTime !== null && (
              <span className="ms-2">
                <Badge bg="info">Execution time: {executionTime}s</Badge>
              </span>
            )}
          </div>

          {/* Request */}
          <Card className="mb-3">
            <Card.Header>Request JSON</Card.Header>
            <Card.Body>
              <Form.Control
                as="textarea"
                rows={14}
                value={requestText}
                onChange={(e) => {
                  setRequestText(e.target.value);
                  setCaretPos(e.target.selectionStart || 0);
                }}
                onClick={handleTextareaCursor}
                onKeyUp={handleTextareaCursor}
                spellCheck={false}
                style={{ fontFamily: 'monospace' }}
                ref={setTextareaRef}        // works in RB v2+
                inputRef={setTextareaRef}   // works in RB v1
              />
              {/* caret position status */}
              <div className="d-flex justify-content-between align-items-center mt-1 small text-muted">
                <div>Cursor: line {caretLineCol.line}, col {caretLineCol.col}</div>
                {errorLineCol && (
                  <div>
                    Parse error at line <strong>{errorLineCol.line}</strong>, col <strong>{errorLineCol.col}</strong>
                    {typeof errorPos === 'number' ? <> (pos {errorPos})</> : null}
                  </div>
                )}
              </div>

              {error && (
                <>
                  <div className="text-danger mt-2">{error}</div>
                  {errorCaretIndicator}
                  <div className="mt-2 d-flex gap-2">
                    <Button size="sm" variant="outline-danger" onClick={jumpToError}>
                      Jump to error
                    </Button>
                  </div>
                </>
              )}

              <div className="d-flex gap-2 mt-3">
                <Button variant="secondary" onClick={handleFormat} disabled={status === 'sending'}>
                  Format JSON
                </Button>
                <Button variant="primary" onClick={handleSend} disabled={status === 'sending'}>
                  {status === 'sending' ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" /> Sending…
                    </>
                  ) : (
                    'Send'
                  )}
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Response */}
          <Card>
            <Card.Header>Response</Card.Header>
            <Card.Body>
              <Form.Control
                as="textarea"
                rows={14}
                value={responseText}
                readOnly
                spellCheck={false}
                placeholder="Send a request to see the response here…"
                style={{ fontFamily: 'monospace' }}
              />
              {!!responseText && (
                <div className="d-flex gap-2 mt-2">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(responseText)}
                  >
                    Copy
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([responseText], { type: 'application/json;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `jsonrpc-response-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    Download
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* History on the side */}
        <Col md={3}>
          <Card className="mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>History</span>
              <Button size="sm" variant="outline-danger" onClick={handleClearHistory} disabled={!history.length}>
                Clear All
              </Button>
            </Card.Header>
            <Card.Body>
              <InputGroup className="mb-2">
                <DropdownButton
                  title={selectedHistoryId
                    ? (history.find(h => h.id === selectedHistoryId)?.label ?? 'Select a previous request')
                    : 'Select a previous request'}
                  variant="outline-secondary"
                  id="history-dropdown"
                >
                  {history.length === 0 && (
                    <Dropdown.ItemText className="text-muted">No previous requests</Dropdown.ItemText>
                  )}
                  {history.map((item) => (
                    <div key={item.id} className="d-flex align-items-stretch">
                      <Dropdown.Item
                        as="button"
                        className="flex-grow-1 text-wrap"
                        onClick={() => handleSelectHistory(item.id)}
                        title={item.label}
                      >
                        {item.label}
                        <div className="small text-muted">{new Date(item.createdAt).toLocaleString()}</div>
                      </Dropdown.Item>
                      <Button
                        variant="link"
                        className="text-danger text-decoration-none px-2"
                        onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(item.id); }}
                        title="Delete"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </DropdownButton>
              </InputGroup>

              <div className="small text-muted">
                Most recent shown first. <br/>Up to {HISTORY_LIMIT} entries are saved in your browser.
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ExecuteJSON;
