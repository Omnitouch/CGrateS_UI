import { jsonrepair } from 'jsonrepair';
import {
  parse, printParseErrorCode, findNodeAtLocation, parseTree, modify, applyEdits, type ParseError, type JSONPath,
} from 'jsonc-parser';

export interface Problem {
  severity: 'error' | 'warning';
  message: string;
  hint?: string;
  offset: number;
  length: number;
  line: number;
  col: number;
}

export interface Diagnosis {
  valid: boolean;
  problems: Problem[];
  /** Repaired, pretty-printed request, when the text is broken but repairable. */
  fixed: string | null;
}

export const PLACEHOLDER_PREFIX = 'FILL_IN: ';

function lineCol(text: string, offset: number) {
  const before = text.slice(0, offset);
  const line = (before.match(/\n/g) || []).length + 1;
  return { line, col: offset - before.lastIndexOf('\n') };
}

function problem(text: string, severity: Problem['severity'], offset: number, length: number, message: string, hint?: string): Problem {
  return { severity, message, hint, offset, length, ...lineCol(text, offset) };
}

const PY_LITERALS: Record<string, string> = { True: 'true', False: 'false', None: 'null' };
const JSON_WORDS = new Set(['true', 'false', 'null']);

/**
 * Rewrites Python-dict-isms into JSON, reporting each one. Done before the JSON parser runs
 * because a single `True` or `str(...)` otherwise produces a cascade of misleading errors.
 */
function fixPythonisms(text: string): { out: string; problems: Problem[] } {
  const problems: Problem[] = [];
  let out = '';
  let i = 0;
  const n = text.length;

  const skipQuoted = (start: number, quote: string) => {
    let j = start + 1;
    while (j < n && text[j] !== quote && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
    return Math.min(j + 1, n);
  };

  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      const end = skipQuoted(i, '"');
      out += text.slice(i, end);
      i = end;
    } else if (ch === "'") {
      const end = skipQuoted(i, "'");
      const inner = text.slice(i + 1, text[end - 1] === "'" ? end - 1 : end).replace(/\\'/g, "'").replace(/"/g, '\\"');
      problems.push(problem(text, 'error', i, end - i, `Single-quoted string ${text.slice(i, end)}`,
        'JSON strings must use double quotes.'));
      out += `"${inner}"`;
      i = end;
    } else if (/[A-Za-z_]/.test(ch)) {
      const word = /^[A-Za-z_]\w*/.exec(text.slice(i))![0];
      let j = i + word.length;
      if (JSON_WORDS.has(word)) {
        out += word;
        i = j;
        continue;
      }
      if (PY_LITERALS[word]) {
        problems.push(problem(text, 'error', i, word.length, `Python ${word}`,
          `JSON is lowercase: use ${PY_LITERALS[word]}.`));
        out += PY_LITERALS[word];
        i = j;
        continue;
      }
      // Swallow a whole expression such as str(cfg['ocs']['tenant']) or cfg.tenant.
      let depth = 0;
      while (j < n) {
        const c = text[j];
        if (c === '"' || c === "'") { j = skipQuoted(j, c); continue; }
        if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') { if (depth === 0) break; depth--; }
        else if (depth === 0 && !/[\w.]/.test(c)) break;
        j++;
      }
      const expr = text.slice(i, j);
      const isKey = expr === word && /^\s*:/.test(text.slice(j));
      if (isKey) {
        problems.push(problem(text, 'error', i, word.length, `Unquoted property name ${word}`,
          `Property names must be in double quotes: "${word}".`));
        out += `"${word}"`;
      } else {
        problems.push(problem(text, 'error', i, expr.length, `${expr} is code, not a value`,
          'The server can\'t evaluate code. Replace it with the actual value; the suggested fix leaves a FILL_IN placeholder here.'));
        out += JSON.stringify(PLACEHOLDER_PREFIX + expr);
      }
      i = j;
    } else {
      out += ch;
      i++;
    }
  }
  return { out, problems };
}

function prevSignificant(text: string, offset: number) {
  let j = offset - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  return j >= 0 ? { ch: text[j], offset: j } : null;
}

function describeParseError(text: string, e: ParseError): Problem {
  const tok = text.slice(e.offset, e.offset + Math.max(e.length, 1));
  const prev = prevSignificant(text, e.offset);
  const at = (msg: string, hint?: string, off = e.offset, len = e.length) => problem(text, 'error', off, Math.max(len, 1), msg, hint);
  switch (printParseErrorCode(e.error)) {
    case 'ValueExpected':
    case 'PropertyNameExpected':
      if (prev?.ch === ',' && (tok === ']' || tok === '}')) {
        return at('Trailing comma', `Remove the comma before ${tok}; JSON doesn't allow one after the last item.`, prev.offset, 1);
      }
      if (printParseErrorCode(e.error) === 'PropertyNameExpected') {
        return at(`Expected a property name, found ${JSON.stringify(tok)}`, 'Property names must be double-quoted strings.');
      }
      return at(`Expected a value, found ${JSON.stringify(tok)}`, 'Values are strings in double quotes, numbers, true, false, null, objects or arrays.');
    case 'CommaExpected':
      return at('Missing comma', `Add a comma after line ${prev ? lineCol(text, prev.offset).line : '?'}, before ${JSON.stringify(tok)}.`, prev ? prev.offset + 1 : e.offset, 1);
    case 'ColonExpected':
      return at('Missing colon', 'Separate the property name and its value with ":".');
    case 'CloseBraceExpected':
      return at('Missing }', 'An object was opened with { but never closed.');
    case 'CloseBracketExpected':
      return at('Missing ]', 'An array was opened with [ but never closed.');
    case 'UnexpectedEndOfString':
      return at('Unterminated string', 'A string is missing its closing double quote.');
    case 'InvalidCharacter':
      return at('Invalid character inside a string', 'Tabs and line breaks inside strings must be escaped as \\t and \\n.');
    case 'InvalidEscapeCharacter':
      return at('Invalid escape sequence', 'Backslashes in strings must be escaped as \\\\.');
    case 'InvalidNumberFormat':
      return at('Invalid number', 'Numbers can\'t have leading zeros, a trailing dot or a leading +.');
    case 'InvalidCommentToken':
    case 'UnexpectedEndOfComment':
      return at('Comment', 'JSON doesn\'t allow comments; remove it.');
    case 'EndOfFileExpected':
      return at('Extra content after the end of the JSON', 'Only one top-level value is allowed; remove what follows.');
    case 'InvalidSymbol':
      return at(`Unexpected ${JSON.stringify(tok)}`);
    default:
      return at(`Syntax error at ${JSON.stringify(tok)}`);
  }
}

function checkEnvelope(text: string, value: unknown): Problem[] {
  const problems: Problem[] = [];
  const tree = parseTree(text);
  const nodeAt = (path: JSONPath) => (tree && findNodeAtLocation(tree, path)) || tree;
  const warn = (path: JSONPath, message: string, hint?: string, severity: Problem['severity'] = 'warning') => {
    const node = nodeAt(path);
    problems.push(problem(text, severity, node?.offset ?? 0, node?.length ?? 1, message, hint));
  };

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    warn([], 'Request must be a JSON object', 'Expected {"method": "...", "params": [{...}]}.', 'error');
    return problems;
  }
  const req = value as Record<string, unknown>;
  if (typeof req.method !== 'string' || !req.method) {
    warn(['method'], 'Missing "method"', 'Add e.g. "method": "APIerSv2.GetAccount".', 'error');
  } else if (!/^\w+\.\w+$/.test(req.method)) {
    warn(['method'], `Method "${req.method}" doesn't look like Service.Method`, 'e.g. APIerSv2.GetAccount. Names are case-sensitive.');
  }
  if (req.params === undefined) {
    warn([], 'Missing "params"', 'CGrateS expects "params": [{...}].');
  } else if (!Array.isArray(req.params)) {
    warn(['params'], '"params" should be an array', 'Wrap the object in brackets: "params": [{...}].');
  }

  const walk = (v: unknown, path: JSONPath) => {
    if (typeof v === 'string' && v.startsWith(PLACEHOLDER_PREFIX)) {
      warn(path, `Placeholder left in: ${v.slice(PLACEHOLDER_PREFIX.length)}`, 'Replace it with the real value before sending.', 'error');
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, [...path, i]));
    } else if (v && typeof v === 'object') {
      Object.entries(v).forEach(([k, x]) => walk(x, [...path, k]));
    }
  };
  walk(req, []);
  return problems;
}

export function diagnose(text: string): Diagnosis {
  const errors: ParseError[] = [];
  const value = parse(text, errors, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  if (errors.length === 0) {
    return { valid: true, problems: checkEnvelope(text, value), fixed: null };
  }

  const py = fixPythonisms(text);
  const problems = [...py.problems];
  const pyErrors: ParseError[] = [];
  parse(py.out, pyErrors, { disallowComments: true, allowTrailingComma: false });
  // Python fixes keep line breaks, so lines still match the original even where columns shift.
  const seenLines = new Set(problems.map(p => p.line));
  for (const e of pyErrors) {
    const p = describeParseError(py.out, e);
    if (seenLines.has(p.line)) continue;
    seenLines.add(p.line);
    const lineStart = text.split('\n').slice(0, p.line - 1).join('\n').length + (p.line > 1 ? 1 : 0);
    const lineLen = text.split('\n')[p.line - 1]?.length ?? 0;
    problems.push({ ...p, offset: lineStart + Math.min(p.col - 1, lineLen), length: Math.max(1, Math.min(p.length, lineLen - p.col + 1)) });
  }
  if (problems.length === 0) problems.push(problem(text, 'error', 0, 1, 'Invalid JSON'));
  problems.sort((a, b) => a.offset - b.offset);

  let fixed: string | null = null;
  try {
    fixed = JSON.stringify(JSON.parse(jsonrepair(py.out)), null, 2);
  } catch { /* not repairable */ }
  return { valid: false, problems, fixed };
}

export interface ResponseHint {
  message: string;
  /** Request text with the fix applied, when one can be made automatically. */
  fixed?: string;
  fixLabel?: string;
}

const GO_NUMBER_TYPES = /^u?int\d*$|^float\d+$/;

function goFieldToPath(field: string): JSONPath {
  // CGrateS reports the field relative to "params", e.g. ".0.Actions.0.Units".
  return ['params', ...field.split('.').filter(Boolean).map(s => (/^\d+$/.test(s) ? Number(s) : s))];
}

function setAtPath(text: string, path: JSONPath, value: unknown) {
  return applyEdits(text, modify(text, path, value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
}

export function explainResponseError(error: string, requestText: string): ResponseHint | null {
  const unmarshal = /cannot unmarshal (\w+) into Go struct field (\S+) of type (\S+)/.exec(error);
  if (unmarshal) {
    const [, got, field, want] = unmarshal;
    const name = field.split('.').pop();
    const path = goFieldToPath(field);
    const tree = parseTree(requestText);
    const node = tree && findNodeAtLocation(tree, path);
    const current = node?.value;
    if (want === 'string' && got !== 'string') {
      return {
        message: `${name} must be a string. Put the value in double quotes.`,
        ...(node && { fixed: setAtPath(requestText, path, String(current)), fixLabel: `Change ${name} to "${current}"` }),
      };
    }
    if (GO_NUMBER_TYPES.test(want) && got === 'string') {
      if (typeof current === 'string' && current.trim() !== '' && !isNaN(Number(current))) {
        return {
          message: `${name} must be a number, not a string. Remove the quotes.`,
          fixed: setAtPath(requestText, path, Number(current)),
          fixLabel: `Change ${name} to ${Number(current)}`,
        };
      }
      if (name === 'BalanceWeight' && /^\*time_(desc|asc)$/.test(String(current))) {
        const method = (parse(requestText) as { method?: string })?.method ?? '';
        if (/^(apierv1|apiersv1)\.setactions$/i.test(method)) {
          return {
            message: `${current} is only accepted by APIerSv2.SetActions, which also wants Units as a string.`,
            fixed: setAtPath(requestText, ['method'], 'APIerSv2.SetActions'),
            fixLabel: 'Switch to APIerSv2.SetActions',
          };
        }
      }
      return { message: `${name} must be a number, but "${current ?? ''}" was sent.` };
    }
    if (want === 'bool') {
      const asBool = String(current).toLowerCase();
      return {
        message: `${name} must be true or false, without quotes.`,
        ...((asBool === 'true' || asBool === 'false') && { fixed: setAtPath(requestText, path, asBool === 'true'), fixLabel: `Change ${name} to ${asBool}` }),
      };
    }
    return { message: `${name} was sent as a ${got} but CGrateS expects ${want}.` };
  }
  if (/can't find (service|method)/i.test(error)) {
    return { message: 'CGrateS doesn\'t know this method. Names are case-sensitive (e.g. APIerSv1 vs ApierV1), and the service must be enabled in cgrates.json.' };
  }
  const missing = /MANDATORY_IE_MISSING: \[([^\]]*)\]/.exec(error);
  if (missing) {
    return { message: `Required fields missing: ${missing[1].split(/[\s,]+/).filter(Boolean).join(', ')}.` };
  }
  if (/NOT_FOUND/.test(error)) {
    return { message: 'Nothing matched. Check the IDs and the Tenant.' };
  }
  if (/EXISTS/.test(error)) {
    return { message: 'It already exists. Set "Overwrite": true to replace it.' };
  }
  return null;
}
