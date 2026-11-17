import type { FilterRule } from './types';

/** A filter rule in plain words: `${subject} ${verb} ${values joined by "or"}`. */
export interface RuleText {
  subject: string;
  verb: string;
  values: string[];
  raw: string;
}

// [positive, negated] verbs for the rule types whose meaning reads cleanly (engine/filters.go).
const VERBS: Record<string, [string, string]> = {
  '*string': ['is', 'is not'],
  '*prefix': ['starts with', 'does not start with'],
  '*suffix': ['ends with', 'does not end with'],
  '*contains': ['contains', 'does not contain'],
  '*empty': ['is empty', 'is not empty'],
  '*exists': ['is set', 'is not set'],
  '*lt': ['is less than', 'is not less than'],
  '*lte': ['is at most', 'is not at most'],
  '*gt': ['is greater than', 'is not greater than'],
  '*gte': ['is at least', 'is not at least'],
  '*eq': ['equals', 'does not equal'],
  '*timings': ['is within timing', 'is not within timing'],
  '*destinations': ['is in destination', 'is not in destination'],
  '*regex': ['matches', 'does not match'],
  '*ipnet': ['is in network', 'is not in network'],
};

/** "~*req.Account" -> "Account"; other data paths keep their prefix, e.g. "*opts.*context". */
export function fieldLabel(element: string): string {
  const e = element.replace(/^~/, '');
  return e.startsWith('*req.') ? e.slice(5) : e;
}

export function rawRule(r: FilterRule): string {
  return `${r.Type}:${r.Element}:${(r.Values || []).join('|')}`;
}

/** Null for rule types without a plain reading (*rsr, *ai, *apiban, *http#...). */
export function describeRule(r: FilterRule): RuleText | null {
  const negated = r.Type.startsWith('*not');
  const verbs = VERBS[negated ? `*${r.Type.slice(4)}` : r.Type];
  if (!verbs || !r.Element) return null;
  return { subject: fieldLabel(r.Element), verb: verbs[negated ? 1 : 0], values: r.Values || [], raw: rawRule(r) };
}

export function ruleTextString(t: RuleText): string {
  return t.values.length ? `${t.subject} ${t.verb} ${t.values.join(' or ')}` : `${t.subject} ${t.verb}`;
}

/** Parses an inline filter (`*type:element:v1|v2`, engine.NewFilterFromInline); null for a filter ID. */
export function parseInlineFilter(s: string): FilterRule | null {
  if (!s.startsWith('*')) return null;
  const i = s.indexOf(':');
  const j = i < 0 ? -1 : s.indexOf(':', i + 1);
  if (j < 0) return null;
  const vals = s.slice(j + 1);
  return { Type: s.slice(0, i), Element: s.slice(i + 1, j), Values: vals ? vals.split('|') : [] };
}

/** Plain text for a FilterIDs entry, or null when it is a filter ID or an unreadable inline rule. */
export function describeFilterId(s: string): string | null {
  const rule = parseInlineFilter(s);
  const t = rule && describeRule(rule);
  return t ? ruleTextString(t) : null;
}
