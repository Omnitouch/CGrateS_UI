import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SavingsIcon from '@mui/icons-material/Savings';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import BoltIcon from '@mui/icons-material/Bolt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import * as api from './api';
import type { HNode } from './components/HierarchyTree';
import { formatBalanceValue } from './components/BalanceValue';
import type { Account, AccountActionPlan, ActionTriggerEntry, Balance } from './types';

const C = {
  account: '#1565c0', group: '#7b1fa2', balance: '#2e7d32', plan: '#0277bd', trigger: '#e65100', actions: '#5d4037', part: '#6d4c41',
};

interface ActionPart {
  Id: string; ActionType: string; ExtraParameters: string; ExpirationString: string; Weight: number;
  Balance: { ID: string; Type: string; Value: { Static?: number } | number | null } | null;
}

const ZERO = '0001-01-01';
const isSet = (t: string | undefined | null) => !!t && !t.startsWith(ZERO);

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function balanceStatus(b: Balance): HNode['status'] {
  if (b.Disabled) return 'default';
  if (isSet(b.ExpirationDate) && new Date(b.ExpirationDate) < new Date()) return 'error';
  return 'success';
}

function balanceNode(parentId: string, b: Balance, type: string): HNode {
  const status = balanceStatus(b);
  return {
    id: `${parentId}/bal:${b.Uuid}`, label: 'Balance', value: b.ID || b.Uuid.slice(0, 8), color: C.balance, icon: SavingsIcon, status,
    badge: status === 'error' ? 'expired' : b.Disabled ? 'disabled' : undefined,
    subtext: `${formatBalanceValue(b.Value, type)}${isSet(b.ExpirationDate) ? ` · until ${new Date(b.ExpirationDate).toLocaleDateString()}` : ''}`,
    details: [
      ['Value', formatBalanceValue(b.Value, type)], ['Type', type], ['UUID', b.Uuid], ['Weight', b.Weight],
      ['Expires', isSet(b.ExpirationDate) ? new Date(b.ExpirationDate).toLocaleString() : 'Never'],
      ['Destinations', typeof b.DestinationIDs === 'object' && b.DestinationIDs
        ? Object.entries(b.DestinationIDs).map(([k, v]) => (v ? k : `!${k}`)).join(', ') || 'Any' : String(b.DestinationIDs ?? 'Any')],
      ['Rating subject', b.RatingSubject || 'None'],
      ['Disabled', b.Disabled ? 'Yes' : 'No'], ['Blocker', b.Blocker ? 'Yes' : 'No'],
    ],
    raw: b,
  };
}

function partValue(p: ActionPart): string {
  const v = p.Balance?.Value;
  const n = typeof v === 'number' ? v : v?.Static;
  return n === undefined || n === null ? '' : formatBalanceValue(n, p.Balance?.Type);
}

type ActionsLoader = (id: string) => Promise<ActionPart[] | undefined>;

function actionsNode(parentId: string, actionsId: string, load: ActionsLoader): HNode {
  const id = `${parentId}/acts:${actionsId}`;
  return {
    id, label: 'Actions', value: actionsId, color: C.actions, icon: PlayArrowIcon,
    loadDetails: async () => {
      const parts = await load(actionsId);
      if (!parts) return { status: 'error', subtext: 'Not found', details: [['Error', 'No actions with this ID']] };
      return { subtext: parts.map(p => p.ActionType).join(', '), raw: parts };
    },
    loadChildren: async () => {
      const parts = await load(actionsId);
      if (!parts) throw new Error(`No actions with ID ${actionsId}`);
      return parts.map((p, i) => ({
        id: `${id}/p${i}`, label: 'Action', value: p.ActionType, color: C.part,
        subtext: [p.Balance?.Type, partValue(p), p.Balance?.ID].filter(Boolean).join(' · ') || p.ExtraParameters,
        details: [
          ['Type', p.ActionType], ['Balance type', p.Balance?.Type || '—'], ['Units', partValue(p) || '—'], ['Balance ID', p.Balance?.ID || '—'],
          ['Expiry', p.ExpirationString || '—'], ['Extra parameters', p.ExtraParameters || '—'], ['Weight', p.Weight],
        ] as [string, string | number][],
        raw: p,
      }));
    },
  };
}

function triggerNode(parentId: string, t: ActionTriggerEntry, load: ActionsLoader): HNode {
  const id = `${parentId}/trg:${t.UniqueID}`;
  return {
    id, label: 'Action Trigger', value: t.ID, color: C.trigger, icon: BoltIcon,
    status: t.Executed && !t.Recurrent ? 'default' : 'success',
    badge: t.Executed ? 'fired' : undefined,
    subtext: `${t.ThresholdType} ${formatBalanceValue(t.ThresholdValue, t.Balance?.Type)}${t.Balance?.Type ? ` ${t.Balance.Type}` : ''}`,
    details: [
      ['Threshold', `${t.ThresholdType} ${formatBalanceValue(t.ThresholdValue, t.Balance?.Type)}`],
      ['Balance type', t.Balance?.Type || 'Any'], ['Recurrent', t.Recurrent ? 'Yes' : 'No'],
      ['Executed', t.Executed ? `Yes${isSet(t.LastExecutionTime) ? `, ${new Date(t.LastExecutionTime).toLocaleString()}` : ''}` : 'No'],
      ['Unique ID', t.UniqueID], ['Weight', t.Weight],
    ],
    raw: t,
    children: [actionsNode(id, t.ActionsID, load)],
  };
}

export async function accountTree(baseUrl: string, tenant: string, account: string): Promise<HNode> {
  const cache = new Map<string, Promise<ActionPart[] | undefined>>();
  const load: ActionsLoader = actionsId => {
    if (!cache.has(actionsId)) {
      cache.set(actionsId, (api.getActionsByIds(baseUrl, [actionsId]) as Promise<Record<string, ActionPart[]> | null>).then(r => r?.[actionsId]));
    }
    return cache.get(actionsId)!;
  };
  const [accs, plans] = await Promise.all([
    api.getAccounts(baseUrl, tenant, 0, 1, [account]) as Promise<Account[]>,
    (api.getAccountActionPlan(baseUrl, tenant, account) as Promise<AccountActionPlan[] | null>).catch(e => {
      if (e instanceof Error && e.message.includes('NOT_FOUND')) return [];
      throw e;
    }),
  ]);
  const acc = accs?.[0];
  if (!acc) throw new Error(`Account ${account} not found`);
  const id = `acc:${acc.ID}`;

  const types = Object.entries(acc.BalanceMap || {}).filter(([, bs]) => bs.length).sort(([a], [b]) => a.localeCompare(b));
  const balanceCount = types.reduce((n, [, bs]) => n + bs.length, 0);
  const balances: HNode = {
    id: `${id}/balances`, label: 'Balances', value: `Balances (${balanceCount})`, color: C.group, icon: AccountBalanceWalletIcon,
    subtext: types.map(([t, bs]) => `${t} ${bs.length}`).join(', ') || 'None',
    children: types.map(([type, bs]) => {
      const tid = `${id}/balances/${type}`;
      const total = bs.filter(b => !b.Disabled).reduce((n, b) => n + b.Value, 0);
      return {
        id: tid, label: 'Balance type', value: type, color: C.group, icon: AccountBalanceWalletIcon, badge: String(bs.length),
        subtext: `total ${formatBalanceValue(total, type)}`,
        details: [['Balances', bs.length], ['Total (enabled)', formatBalanceValue(total, type)]],
        children: [...bs].sort((a, b) => b.Weight - a.Weight).map(b => balanceNode(tid, b, type)),
      };
    }),
  };

  const planList = plans || [];
  const planGroup: HNode = {
    id: `${id}/plans`, label: 'Action Plans', value: `Action Plans (${planList.length})`, color: C.plan, icon: EventRepeatIcon,
    subtext: planList.map(p => p.ActionPlanId).join(', ') || 'None',
    children: planList.map((p, i) => {
      const pid = `${id}/plans/${i}`;
      return {
        id: pid, label: 'Action Plan', value: p.ActionPlanId, color: C.plan, icon: EventRepeatIcon,
        subtext: isSet(p.NextExecTime) ? `next ${new Date(p.NextExecTime).toLocaleString()}` : 'no next run',
        details: [['Actions', p.ActionsId], ['Next run', isSet(p.NextExecTime) ? new Date(p.NextExecTime).toLocaleString() : 'None scheduled'], ['Timing UUID', p.Uuid]],
        raw: p,
        children: [actionsNode(pid, p.ActionsId, load)],
      };
    }),
  };

  const triggers = acc.ActionTriggers || [];
  const triggerGroup: HNode = {
    id: `${id}/triggers`, label: 'Action Triggers', value: `Action Triggers (${triggers.length})`, color: C.trigger, icon: BoltIcon,
    subtext: `${triggers.filter(t => t.Executed).length} fired`,
    children: triggers.map(t => triggerNode(`${id}/triggers`, t, load)),
  };

  return {
    id, label: 'Account', value: acc.ID.split(':').slice(1).join(':') || acc.ID, color: C.account, icon: PersonIcon,
    status: acc.Disabled ? 'default' : 'success', badge: acc.Disabled ? 'disabled' : undefined,
    subtext: `${tenant} · ${plural(balanceCount, 'balance')}`,
    details: [
      ['Tenant', tenant], ['Allow negative', acc.AllowNegative ? 'Yes' : 'No'], ['Disabled', acc.Disabled ? 'Yes' : 'No'],
      ['Updated', isSet(acc.UpdateTime) ? new Date(acc.UpdateTime).toLocaleString() : '—'],
    ],
    raw: acc,
    children: [balances, planGroup, triggerGroup],
  };
}
