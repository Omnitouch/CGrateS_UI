import { Fragment, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { FilterRule } from '../types';
import { describeFilterId, describeRule, rawRule } from '../filterText';

const mono = { fontFamily: 'monospace', fontSize: '0.8em' };

/** One FilterIDs entry: plain words for an inline rule, the raw text otherwise; raw text on hover. */
export function FilterIdText({ id }: { id: string }) {
  const text = describeFilterId(id);
  return text ? <span title={id}>{text}</span> : <Box component="span" sx={mono}>{id}</Box>;
}

/** A list of FilterIDs, ANDed as CGrateS does; empty means every event. */
export function FilterIdsText({ ids, empty = 'Every event' }: { ids: string[] | null | undefined; empty?: string }) {
  if (!ids?.length) return <Typography variant="body2" color="text.secondary" component="span">{empty}</Typography>;
  return (
    <>
      {ids.map((id, i) => (
        <Box key={i} sx={{ display: 'block' }}>{i > 0 && <Typography component="span" variant="caption" color="text.secondary">and </Typography>}<FilterIdText id={id} /></Box>
      ))}
    </>
  );
}

/** A filter rule in plain words; renderValue lets a caller turn values into links. */
export function FilterRuleText({ rule, renderValue }: { rule: FilterRule; renderValue?: (field: string, value: string) => ReactNode }) {
  const t = describeRule(rule);
  if (!t) return <Box component="span" sx={mono}>{rawRule(rule)}</Box>;
  return (
    <span title={t.raw}>
      {t.subject} {t.verb}
      {t.values.map((v, i) => (
        <Fragment key={i}>{i > 0 ? ' or ' : ' '}<strong>{renderValue ? renderValue(t.subject, v) : v}</strong></Fragment>
      ))}
    </span>
  );
}
