import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import JsonTree, { parseJsonString } from './JsonTree';
import { formatBalanceValue } from './BalanceValue';
import { formatDateTime } from '../formatTime';

// engine.EventCost as CGrateS marshals it.
interface BalanceSummary { UUID: string; ID: string; Type: string; Initial: number; Value: number; Weight?: number; Disabled: boolean }
interface AccountSummary { Tenant: string; AccountID: string; BalanceSummaries: BalanceSummary[] | null; AllowNegative: boolean; Disabled: boolean }
interface ChargingIncrement { Usage: number; Cost: number; AccountingID: string; CompressFactor: number }
interface ChargingInterval { RatingID: string; Increments: ChargingIncrement[] | null; CompressFactor: number }
interface BalanceCharge { AccountID: string; BalanceUUID: string; RatingID: string; Units: number; BalanceFactor?: number; ExtraChargeID: string }
interface RatingUnit { ConnectFee: number; RoundingMethod: string; RoundingDecimals: number; MaxCost: number; MaxCostStrategy: string; TimingID: string; RatesID: string; RatingFiltersID: string }
interface EventCost {
  CGRID: string; RunID: string; StartTime: string; Usage: number | null; Cost: number | null;
  Charges: ChargingInterval[] | null; AccountSummary: AccountSummary | null;
  Rating: Record<string, RatingUnit> | null; Accounting: Record<string, BalanceCharge> | null;
}

// Strips float noise like 0.30000000000000004 from differences.
const clean = (n: number) => Number(n.toPrecision(12));

const usageUnit = (tor: string) => (tor === '*data' ? '*data' : tor === '*voice' ? '*voice' : undefined);

function Amount({ raw, type, strong }: { raw: number; type: string; strong?: boolean }) {
  const pretty = formatBalanceValue(raw, type);
  return (
    <>
      <Box component="span" sx={{ fontWeight: strong ? 700 : undefined }}>{pretty}</Box>
      {pretty !== String(raw) && <Typography variant="caption" display="block" color="text.secondary">{raw}</Typography>}
    </>
  );
}

function balanceName(b: BalanceSummary) {
  return b.ID || <Typography component="span" variant="body2" color="text.secondary" fontStyle="italic">(unnamed)</Typography>;
}

function BalanceChanges({ summary }: { summary: AccountSummary }) {
  const balances = summary.BalanceSummaries || [];
  const rows = balances
    .map(b => ({ b, delta: clean(b.Value - b.Initial) }))
    .sort((x, y) => Number(y.delta !== 0) - Number(x.delta !== 0));
  const changed = rows.filter(r => r.delta !== 0).length;
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Balances — {changed ? `${changed} changed` : 'none changed'}, {rows.length - changed} unchanged
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Balance</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Change</TableCell>
            <TableCell align="right">Before</TableCell>
            <TableCell align="right">After</TableCell>
            <TableCell align="right">Weight</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(({ b, delta }, i) => {
            const dim = delta === 0 ? { color: 'text.disabled' } : undefined;
            return (
              <TableRow key={b.UUID || i} sx={delta !== 0 ? { bgcolor: 'action.hover' } : undefined}>
                <TableCell sx={dim}>
                  {balanceName(b)}
                  {b.Disabled && <Chip size="small" label="disabled" sx={{ ml: 1 }} />}
                  {b.UUID && <Typography variant="caption" display="block" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{b.UUID}</Typography>}
                </TableCell>
                <TableCell sx={dim}>{b.Type}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {delta === 0
                    ? <Typography component="span" variant="body2" color="text.disabled">no change</Typography>
                    : <Box component="span" sx={{ color: delta < 0 ? 'warning.main' : 'success.main' }}>
                        <Amount raw={delta} type={b.Type} strong />
                      </Box>}
                </TableCell>
                <TableCell align="right" sx={{ ...dim, whiteSpace: 'nowrap' }}><Amount raw={b.Initial} type={b.Type} /></TableCell>
                <TableCell align="right" sx={{ ...dim, whiteSpace: 'nowrap' }}><Amount raw={b.Value} type={b.Type} /></TableCell>
                <TableCell align="right" sx={dim}>{b.Weight ?? ''}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </Box>
    </Box>
  );
}

function Charges({ ec, tor }: { ec: EventCost; tor: string }) {
  const charges = ec.Charges || [];
  const byUuid = new Map((ec.AccountSummary?.BalanceSummaries || []).map(b => [b.UUID, b]));
  const unit = usageUnit(tor);
  if (!charges.length) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="overline" color="text.secondary">Charges</Typography>
      <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Rating</TableCell>
            <TableCell align="right">Increment</TableCell>
            <TableCell align="right">× Repeats</TableCell>
            <TableCell align="right">Cost each</TableCell>
            <TableCell>Paid from</TableCell>
            <TableCell align="right">Units each</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {charges.flatMap((ci, ciIdx) => (ci.Increments || []).map((inc, incIdx) => {
            const rating = ec.Rating?.[ci.RatingID];
            const acct = inc.AccountingID ? ec.Accounting?.[inc.AccountingID] : undefined;
            const bal = acct ? byUuid.get(acct.BalanceUUID) : undefined;
            const repeats = (ci.CompressFactor || 1) * (inc.CompressFactor || 1);
            return (
              <TableRow key={`${ciIdx}-${incIdx}`}>
                <TableCell>
                  {incIdx === 0 && (
                    <>
                      <Box component="span" sx={{ fontFamily: 'monospace' }}>{ci.RatingID || '—'}</Box>
                      {rating && <Typography variant="caption" display="block" color="text.secondary">
                        {[rating.RatesID && `rates ${rating.RatesID}`, rating.TimingID && `timing ${rating.TimingID}`, rating.ConnectFee && `connect fee ${rating.ConnectFee}`].filter(Boolean).join(' · ')}
                      </Typography>}
                    </>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{unit ? <Amount raw={inc.Usage} type={unit} /> : inc.Usage}</TableCell>
                <TableCell align="right">{repeats}</TableCell>
                <TableCell align="right">{inc.Cost}</TableCell>
                <TableCell>
                  {acct
                    ? <>{bal ? balanceName(bal) : <Box component="span" sx={{ fontFamily: 'monospace' }}>{acct.BalanceUUID}</Box>}
                        {bal && <Typography variant="caption" color="text.secondary"> {bal.Type}</Typography>}
                        {acct.AccountID && acct.AccountID !== `${ec.AccountSummary?.Tenant}:${ec.AccountSummary?.AccountID}` &&
                          <Typography variant="caption" display="block" color="text.secondary">shared from {acct.AccountID}</Typography>}</>
                    : <Typography component="span" variant="body2" color="text.disabled">—</Typography>}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {acct ? (bal ? <Amount raw={acct.Units} type={bal.Type} /> : acct.Units) : ''}
                </TableCell>
              </TableRow>
            );
          }))}
        </TableBody>
      </Table>
      </Box>
    </Box>
  );
}

function asEventCost(value: unknown): EventCost | undefined {
  const v = typeof value === 'string' ? parseJsonString(value) : value;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  return 'Charges' in v || 'AccountSummary' in v ? v as unknown as EventCost : undefined;
}

export default function CostDetailsView({ value, tor }: { value: unknown; tor: string }) {
  const ec = asEventCost(value);
  const unit = usageUnit(tor);
  return (
    <Box>
      {ec && (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 1 }}>
            {[
              ['Run', ec.RunID],
              ['Start', ec.StartTime ? formatDateTime(ec.StartTime) : ''],
              ['Usage', ec.Usage == null ? '' : unit ? formatBalanceValue(ec.Usage, unit) : String(ec.Usage)],
              ['Cost', ec.Cost == null ? '' : String(ec.Cost)],
              ['Account', ec.AccountSummary ? `${ec.AccountSummary.AccountID}` : ''],
            ].map(([k, v]) => (
              <Box key={k}>
                <Typography variant="caption" color="text.secondary" display="block">{k}</Typography>
                <Typography variant="body2">{v || '—'}</Typography>
              </Box>
            ))}
            {ec.AccountSummary?.AllowNegative && <Chip size="small" label="allow negative" sx={{ alignSelf: 'center' }} />}
            {ec.AccountSummary?.Disabled && <Chip size="small" color="warning" label="account disabled" sx={{ alignSelf: 'center' }} />}
          </Box>
          {ec.AccountSummary && <BalanceChanges summary={ec.AccountSummary} />}
          <Charges ec={ec} tor={tor} />
        </>
      )}
      <Accordion disableGutters variant="outlined" defaultExpanded={!ec} sx={{ mt: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="overline" color="text.secondary">Raw CostDetails</Typography>
        </AccordionSummary>
        <AccordionDetails><JsonTree value={value} open /></AccordionDetails>
      </Accordion>
    </Box>
  );
}
