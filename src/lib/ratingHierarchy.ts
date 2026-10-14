import AccountTreeIcon from '@mui/icons-material/AccountTree';
import EventIcon from '@mui/icons-material/Event';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PlaceIcon from '@mui/icons-material/Place';
import PaidIcon from '@mui/icons-material/Paid';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import * as api from './api';
import type { HNode } from './components/HierarchyTree';
import { formatBalanceValue } from './components/BalanceValue';

// Everything below the root loads on expand or select: plans can hold thousands of destinations and rates.

const C = {
  profile: '#1565c0', activation: '#5e35b1', plan: '#0277bd', destRate: '#00838f',
  destination: '#2e7d32', rate: '#e65100', fallback: '#757575', error: '#d32f2f',
};

/** How a rating plan's units read; rating plans themselves don't say which ToR they rate. */
export type UnitHint = 'time' | 'bytes' | 'units';

export function unitHintForCategory(category: string): UnitHint {
  const c = category.toLowerCase();
  if (c.includes('data')) return 'bytes';
  if (c.includes('sms') || c.includes('mms')) return 'units';
  return 'time';
}

function fmtUnit(n: number, hint: UnitHint): string {
  if (hint === 'bytes') return formatBalanceValue(n, '*data');
  if (hint === 'units') return `${n} unit${n === 1 ? '' : 's'}`;
  return formatBalanceValue(n, '*voice');
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Same object opened from two places is fetched once. */
function memo<T>(fn: (key: string) => Promise<T>) {
  const cache = new Map<string, Promise<T>>();
  return (key: string) => {
    if (!cache.has(key)) {
      const p = fn(key);
      cache.set(key, p);
      p.catch(() => cache.delete(key));
    }
    return cache.get(key)!;
  };
}

interface Activation { ActivationTime: string; RatingPlanId: string; FallbackKeys?: string[] | null; FallbackSubjects?: string }

/** Marks the activation in force now, the ones it replaced, and future ones. */
function activationStatus(acts: Activation[], now = Date.now()) {
  const times = acts.map(a => new Date(a.ActivationTime).getTime());
  const current = times.reduce((best, t, i) => (t <= now && (best < 0 || t >= times[best]) ? i : best), -1);
  return times.map((t, i) => (i === current ? 'success' : t > now ? 'info' : 'default') as HNode['status']);
}

function activationNode(parentId: string, a: Activation, i: number, status: HNode['status'], plan: HNode, fallbacks: string[]): HNode {
  const id = `${parentId}/act${i}`;
  return {
    id, label: 'Activation', value: new Date(a.ActivationTime).toLocaleString(), color: C.activation, icon: EventIcon, status,
    badge: status === 'success' ? 'in force' : status === 'info' ? 'future' : undefined,
    subtext: `${a.RatingPlanId}${fallbacks.length ? ` · ${plural(fallbacks.length, 'fallback')}` : ''}`,
    details: [['Activation time', a.ActivationTime], ['Rating plan', a.RatingPlanId], ['Fallbacks', fallbacks.join(', ') || 'None']],
    children: [
      plan,
      ...fallbacks.map((f, j) => ({
        id: `${id}/fb${j}`, label: 'Fallback subject', value: f, color: C.fallback, icon: SubdirectoryArrowRightIcon,
        subtext: 'Tried when the plan has no rate for the destination',
      })),
    ],
  };
}

// --- Live (DataDB) ---

interface LiveRating {
  ConnectFee: number; RoundingMethod: string; RoundingDecimals: number; MaxCost: number; MaxCostStrategy: string;
  Rates: { GroupIntervalStart: number; Value: number; RateIncrement: number; RateUnit: number }[];
}
interface LiveTiming { ID: string; Years: number[]; Months: number[]; MonthDays: number[]; WeekDays: number[]; StartTime: string; EndTime: string }
interface LiveRatingPlan {
  Id: string;
  Timings: Record<string, LiveTiming>;
  Ratings: Record<string, LiveRating>;
  DestinationRates: Record<string, { Timing: string; Rating: string; Weight: number }[]>;
}

function timingText(t: LiveTiming | undefined) {
  if (!t) return 'unknown timing';
  const list = (xs: number[]) => (xs.length ? xs.join(';') : '*any');
  return `${t.ID}: years ${list(t.Years)}, months ${list(t.Months)}, days ${list(t.MonthDays)}, weekdays ${list(t.WeekDays)}, from ${t.StartTime}`;
}

function liveDestinationNode(baseUrl: string, plan: LiveRatingPlan, d: string, parentId: string, hint: UnitHint): HNode {
  const id = `${parentId}/dst:${d}`;
  const bindings = plan.DestinationRates[d];
  const ratesText = bindings.map(b => plan.Ratings[b.Rating]?.Rates.map(s => `${s.Value}/${fmtUnit(s.RateUnit, hint)}`).join(',')).join(' | ');
  return {
    id, label: 'Destination', value: d, color: C.destination, icon: PlaceIcon,
    subtext: d === '*any' ? 'Every destination' : ratesText,
    details: [['Prefixes', d === '*any' ? 'Every destination' : 'Loading…']],
    loadDetails: d === '*any' ? undefined : async () => {
      const px = (await api.getDestination(baseUrl, d)).Prefixes || [];
      return {
        badge: String(px.length),
        details: [['Prefixes', px.length ? px.join(', ') : 'None in DataDB']],
      };
    },
    children: bindings.map((b, i) => {
      const r = plan.Ratings[b.Rating];
      const t = plan.Timings[b.Timing];
      return {
        id: `${id}/rate${i}`, label: 'Rate', value: r ? r.Rates.map(s => `${s.Value} / ${fmtUnit(s.RateUnit, hint)}`).join(', ') : b.Rating,
        color: C.rate, icon: PaidIcon, badge: t && t.ID !== '*any' ? t.ID : undefined,
        subtext: `fee ${r?.ConnectFee ?? '?'} · weight ${b.Weight}`,
        details: r ? [
          ['Connect fee', r.ConnectFee],
          ['Rate slots', r.Rates.map(s => `from ${fmtUnit(s.GroupIntervalStart, hint)}: ${s.Value} per ${fmtUnit(s.RateUnit, hint)}, in steps of ${fmtUnit(s.RateIncrement, hint)}`).join('; ')],
          ['Rounding', `${r.RoundingMethod}, ${r.RoundingDecimals} decimals`],
          ['Max cost', r.MaxCost ? `${r.MaxCost} (${r.MaxCostStrategy || 'no strategy'})` : 'None'],
          ['Timing', timingText(t)],
          ['Weight', b.Weight],
        ] : [['Rating', b.Rating]],
        raw: { binding: b, rating: r, timing: t },
      } as HNode;
    }),
  };
}

export function liveRatingPlanNode(baseUrl: string, planId: string, parentId: string, hint: UnitHint): HNode {
  const id = `${parentId}/plan:${planId}`;
  const load = memo(() => api.getRatingPlan(baseUrl, planId) as Promise<LiveRatingPlan>);
  return {
    id, label: 'Rating Plan', value: planId, color: C.plan, icon: ListAltIcon, subtext: 'live',
    loadDetails: async () => {
      const plan = await load('');
      const n = Object.keys(plan.DestinationRates || {}).length;
      return {
        subtext: `${plural(n, 'destination')} · live`,
        details: [['Destinations', n], ['Timings', Object.values(plan.Timings || {}).map(t => t.ID).join(', ')], ['Distinct ratings', Object.keys(plan.Ratings || {}).length]],
      };
    },
    loadChildren: async () => {
      const plan = await load('');
      return Object.keys(plan.DestinationRates || {}).sort().map(d => liveDestinationNode(baseUrl, plan, d, id, hint));
    },
  };
}

export async function liveRatingProfileTree(baseUrl: string, tenant: string, category: string, subject: string): Promise<HNode> {
  const prof = await api.getRatingProfile(baseUrl, tenant, category, subject) as { Id: string; RatingPlanActivations: Activation[] };
  const acts = prof.RatingPlanActivations || [];
  const status = activationStatus(acts);
  const hint = unitHintForCategory(category);
  const id = `rp:${prof.Id}`;
  return {
    id, label: 'Rating Profile', value: `${category}:${subject}`, color: C.profile, icon: AccountTreeIcon,
    status: status.includes('success') ? 'success' : 'warning',
    subtext: `${tenant} · ${plural(acts.length, 'activation')}`,
    details: [['Tenant', tenant], ['Category', category], ['Subject', subject], ['Source', 'Live DataDB']],
    raw: prof,
    children: acts.map((a, i) => activationNode(id, a, i, status[i],
      liveRatingPlanNode(baseUrl, a.RatingPlanId, `${id}/act${i}`, hint),
      (a.FallbackKeys || []).map(k => k.split(':').slice(3).join(':') || k))),
  };
}

// --- Tariff plan (StorDB) ---

interface TPRatingProfile { LoadId: string; Tenant: string; Category: string; Subject: string; RatingPlanActivations: Activation[] }
interface TPRatingPlan { ID: string; RatingPlanBindings: { DestinationRatesId: string; TimingId: string; Weight: number }[] }
interface DestRateRow { DestinationId: string; RateId: string; RoundingMethod: string; RoundingDecimals: number; MaxCost: number; MaxCostStrategy: string }
interface TPDestRate { ID: string; DestinationRates: DestRateRow[] }
interface TPRate { ID: string; RateSlots: { ConnectFee: number; Rate: number; RateUnit: string; RateIncrement: string; GroupIntervalStart: string }[] }
interface TPTiming { ID: string; Years: string; Months: string; MonthDays: string; WeekDays: string; Time: string }

function tpLoaders(baseUrl: string, tpid: string) {
  return {
    plan: memo(id => api.getTPRatingPlan(baseUrl, tpid, id) as Promise<TPRatingPlan>),
    destRate: memo(id => api.getTPDestinationRate(baseUrl, tpid, id) as Promise<TPDestRate>),
    rate: memo(id => api.getTPRate(baseUrl, tpid, id) as Promise<TPRate>),
    destination: memo(id => api.getTPDestination(baseUrl, tpid, id) as Promise<{ Prefixes: string[] }>),
    timing: memo(id => api.getTPTiming(baseUrl, tpid, id) as Promise<TPTiming>),
  };
}
type TPLoaders = ReturnType<typeof tpLoaders>;

function tpRateNode(L: TPLoaders, row: DestRateRow, id: string): HNode {
  return {
    id, label: 'Rate', value: row.RateId, color: C.rate, icon: PaidIcon,
    subtext: `${row.RoundingMethod}, ${row.RoundingDecimals} dp`,
    details: [
      ['Rounding', `${row.RoundingMethod}, ${row.RoundingDecimals} decimals`],
      ['Max cost', row.MaxCost ? `${row.MaxCost} (${row.MaxCostStrategy || 'no strategy'})` : 'None'],
    ],
    loadDetails: async () => {
      const r = await L.rate(row.RateId);
      const slots = r.RateSlots || [];
      return {
        subtext: slots.map(s => `${s.Rate}/${s.RateUnit}`).join(', ') + (slots[0]?.ConnectFee ? ` · fee ${slots[0].ConnectFee}` : ''),
        details: [
          ...slots.map((s, i) => [`Slot ${i + 1}`, `from ${s.GroupIntervalStart}: fee ${s.ConnectFee}, ${s.Rate} per ${s.RateUnit} in steps of ${s.RateIncrement}`] as [string, string]),
          ['Rounding', `${row.RoundingMethod}, ${row.RoundingDecimals} decimals`],
          ['Max cost', row.MaxCost ? `${row.MaxCost} (${row.MaxCostStrategy || 'no strategy'})` : 'None'],
        ],
        raw: r,
      };
    },
  };
}

function tpDestinationNode(L: TPLoaders, row: DestRateRow, id: string): HNode {
  const any = row.DestinationId === '*any';
  return {
    id, label: 'Destination', value: row.DestinationId, color: C.destination, icon: PlaceIcon,
    subtext: `→ ${row.RateId}`,
    details: [['Prefixes', any ? 'Every destination' : 'Loading…']],
    loadDetails: any ? undefined : async () => {
      const px = (await L.destination(row.DestinationId)).Prefixes || [];
      return { badge: String(px.length), details: [['Prefixes', px.join(', ') || 'None']] };
    },
    children: [tpRateNode(L, row, `${id}/rate`)],
  };
}

function tpDestinationRateNode(L: TPLoaders, drId: string, id: string, binding?: { TimingId: string; Weight: number }): HNode {
  return {
    id, label: 'Destination Rate', value: drId, color: C.destRate, icon: CompareArrowsIcon,
    badge: binding && binding.TimingId !== '*any' ? binding.TimingId : undefined,
    subtext: binding ? `timing ${binding.TimingId} · weight ${binding.Weight}` : undefined,
    details: binding ? [['Timing', binding.TimingId], ['Weight', binding.Weight]] : [],
    loadDetails: async () => {
      const dr = await L.destRate(drId);
      const rows = dr.DestinationRates || [];
      const timing = binding && binding.TimingId !== '*any' ? await L.timing(binding.TimingId).catch(() => null) : null;
      return {
        subtext: `${plural(rows.length, 'destination')}${binding ? ` · weight ${binding.Weight}` : ''}`,
        details: [
          ...(binding ? [['Timing', binding.TimingId], ['Weight', binding.Weight]] as [string, string | number][] : []),
          ...(timing ? [['Timing detail', `years ${timing.Years}, months ${timing.Months}, days ${timing.MonthDays}, weekdays ${timing.WeekDays}, from ${timing.Time}`]] as [string, string][] : []),
          ['Destinations', rows.length],
          ['Distinct rates', new Set(rows.map(r => r.RateId)).size],
        ],
      };
    },
    loadChildren: async () => {
      const dr = await L.destRate(drId);
      return (dr.DestinationRates || []).map((row, i) => tpDestinationNode(L, row, `${id}/d${i}`));
    },
  };
}

function tpRatingPlanNode(L: TPLoaders, planId: string, id: string): HNode {
  return {
    id, label: 'Rating Plan', value: planId, color: C.plan, icon: ListAltIcon, subtext: 'tariff plan',
    loadDetails: async () => {
      const p = await L.plan(planId);
      const bindings = p.RatingPlanBindings || [];
      return {
        subtext: `${plural(bindings.length, 'binding')} · tariff plan`,
        details: bindings.slice(0, 200).map(b => [b.DestinationRatesId, `timing ${b.TimingId}, weight ${b.Weight}`] as [string, string]),
      };
    },
    loadChildren: async () => {
      const p = await L.plan(planId);
      return (p.RatingPlanBindings || []).map((b, i) => tpDestinationRateNode(L, b.DestinationRatesId, `${id}/b${i}`, b));
    },
  };
}

export type TPRootType = 'ratingprofile' | 'ratingplan' | 'destinationrate';

export async function tpTree(baseUrl: string, tpid: string, type: TPRootType, rootId: string): Promise<HNode> {
  const L = tpLoaders(baseUrl, tpid);
  if (type === 'ratingplan') return tpRatingPlanNode(L, rootId, `tp:${rootId}`);
  if (type === 'destinationrate') return tpDestinationRateNode(L, rootId, `tp:${rootId}`);
  const prof = await api.getTPRatingProfile(baseUrl, tpid, rootId) as TPRatingProfile;
  const acts = prof.RatingPlanActivations || [];
  const status = activationStatus(acts);
  const id = `tprp:${rootId}`;
  return {
    id, label: 'Rating Profile', value: `${prof.Category}:${prof.Subject}`, color: C.profile, icon: AccountTreeIcon,
    status: status.includes('success') ? 'success' : 'warning',
    subtext: `${prof.Tenant} · ${plural(acts.length, 'activation')}`,
    details: [['Tariff plan', tpid], ['LoadId', prof.LoadId], ['Tenant', prof.Tenant], ['Category', prof.Category], ['Subject', prof.Subject]],
    raw: prof,
    children: acts.map((a, i) => activationNode(id, a, i, status[i],
      tpRatingPlanNode(L, a.RatingPlanId, `${id}/act${i}/plan`),
      (a.FallbackSubjects || '').split(';').filter(Boolean))),
  };
}
