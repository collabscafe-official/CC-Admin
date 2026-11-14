import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ANALYTICS_CONFIG from '../config/analyticsService';
import { adminServiceHeaders } from '../config/adminServiceHeaders';

// Leads CRM (2026-11-14). Sales works brands from here: stage is computed by
// the analytics service, status / follow-up / response log are set by people.
// Team logins can write on this screen (own log entries + lead status).

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  ...adminServiceHeaders(API_KEY),
  'Content-Type': 'application/json',
});

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/leads${path}`, { ...init, headers: apiHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body as T;
}

// ── Labels ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  new: 'New', contacted: 'Contacted', relevant: 'Relevant',
  not_interested: 'Not interested', won: 'Won', lost: 'Lost',
};
const CHANNEL_LABEL: Record<string, string> = {
  call: 'Call', whatsapp: 'WhatsApp', email: 'Email', voice_note: 'Voice note', meeting: 'Meeting', other: 'Other',
};
const OUTCOME_LABEL: Record<string, string> = {
  no_answer: 'No answer', number_unavailable: 'Number not available', no_reply: 'No reply',
  replied: 'Replied', interested: 'Interested', not_interested: 'Not interested',
};
const REASON_LABEL: Record<string, string> = {
  barter_only: 'Wants barter only', price: 'Price', no_right_creator: "Couldn't find the right creator",
  creator_slow: 'Creator replied late', creator_not_needed: 'Creator not needed anymore',
  payment_issue: 'Payment problem', just_exploring: 'Just exploring', other: 'Other',
};

const STAGE_STYLES: Record<string, string> = {
  'Signed up': 'bg-gray-500/10 text-gray-400',
  Browsing: 'bg-gray-500/15 text-gray-300',
  Shortlisted: 'bg-blue-500/15 text-blue-300',
  Cart: 'bg-amber-500/15 text-amber-300',
  Checkout: 'bg-purple-500/15 text-purple-300',
  'Awaiting payment': 'bg-red-500/15 text-red-300',
  Paid: 'bg-green-500/15 text-green-300',
};
const STATUS_STYLES: Record<string, string> = {
  new: 'bg-dark-700 text-gray-300',
  contacted: 'bg-blue-500/15 text-blue-300',
  relevant: 'bg-primary/20 text-primary',
  not_interested: 'bg-gray-500/15 text-gray-400',
  won: 'bg-green-500/15 text-green-300',
  lost: 'bg-red-500/10 text-red-300',
};

const Pill: React.FC<{ cls: string; children: React.ReactNode }> = ({ cls, children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>
);

// ── Types ──────────────────────────────────────────────────────────────────

interface Open { kind: 'offer' | 'cart'; amount: number; currency: string; count?: number; pay_by?: string }
interface LastLog { channel: string; outcome: string; reasons: string[]; note: string; at: string; by: string }
interface LeadRow {
  brand_id: string; brand_name: string; email: string; phone: string; contact_name: string;
  website: string; city: string; source: string; signed_up_at: string; is_active: boolean;
  stage: string; last_active: string | null; open: Open | null; paid_orders: number;
  status: string; owner: string | null; owner_name: string; next_follow_up: string | null;
  last_contact_at: string | null; logs_count: number; last_log: LastLog | null;
}
interface Summary {
  total: number; by_status: Record<string, number>; by_stage: Record<string, number>;
  due_today: number; hot_never_contacted: number; top_reasons_30d: { reason: string; count: number }[];
}
interface ListResponse { items: LeadRow[]; total: number; page: number; limit: number; summary: Summary }
interface Meta { statuses: string[]; channels: string[]; outcomes: string[]; reasons: string[]; stages: string[]; admins: { _id: string; name: string; type: string }[]; me: { _id: string; type: string } | null }
interface LogEntry { _id: string; channel: string; outcome: string; reasons: string[]; note: string; created_at: string; admin_id: string; by: string }
interface Detail {
  lead: LeadRow;
  contacts: { name: string; email: string; phone: string; designation: string; is_admin: boolean }[];
  offers: { _id: string; creator: string; title: string; amount: number; currency: string; status: string; pay_by: string | null; created_at: string; chat_id: string | null }[];
  orders: { _id: string; total: number; created_at: string; fulfillment_status: string }[];
  logs: LogEntry[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TZ = 'Asia/Karachi';
const money = (n: number, cur = 'PKR') => `${cur} ${Math.round(n).toLocaleString()}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }) : '');
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: TZ }) : '';
function timeAgo(d?: string | null): string {
  if (!d) return '';
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}d ago` : fmtDate(d);
}
function timeLeft(d?: string | null): string {
  if (!d) return '';
  const h = Math.round((new Date(d).getTime() - Date.now()) / 3600e3);
  if (h <= 0) return 'closed';
  return h < 48 ? `${h}h left` : `${Math.round(h / 24)}d left`;
}
// Date input (yyyy-mm-dd) <-> stored timestamp, both in PKT.
const toInputDate = (d?: string | null) => (d ? new Date(new Date(d).getTime() + 5 * 3600e3).toISOString().slice(0, 10) : '');
const fromInputDate = (v: string) => (v ? `${v}T12:00:00+05:00` : null);
function isDue(d?: string | null) {
  if (!d) return false;
  return toInputDate(d) <= toInputDate(new Date().toISOString());
}
function waLink(phone: string) {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '92' + p.slice(1);
  return `https://wa.me/${p}`;
}

// ── Log form ───────────────────────────────────────────────────────────────

const LogForm: React.FC<{ brandId: string; meta: Meta; currentStatus: string; onSaved: () => void }> = ({ brandId, meta, currentStatus, onSaved }) => {
  const [channel, setChannel] = useState('call');
  const [outcome, setOutcome] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const toggle = (r: string) => setReasons(rs => (rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]));

  const save = async () => {
    if (!outcome) { setErr('Pick what happened'); return; }
    setSaving(true); setErr('');
    try {
      await api(`/${brandId}/logs`, {
        method: 'POST',
        body: JSON.stringify({
          channel, outcome, reasons, note,
          status: status || undefined,
          next_follow_up: followUp ? fromInputDate(followUp) : undefined,
        }),
      });
      setOutcome(''); setReasons([]); setNote(''); setStatus(''); setFollowUp('');
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-xs border transition-colors ${active ? 'bg-primary border-primary text-white' : 'border-dark-600 text-gray-300 hover:border-primary'}`;

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 space-y-3">
      <div className="text-sm font-semibold text-white">Log a response</div>
      <div>
        <div className="text-xs text-gray-400 mb-1.5">How</div>
        <div className="flex flex-wrap gap-1.5">
          {meta.channels.map(c => <button key={c} type="button" onClick={() => setChannel(c)} className={chip(channel === c)}>{CHANNEL_LABEL[c] || c}</button>)}
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-400 mb-1.5">What happened</div>
        <div className="flex flex-wrap gap-1.5">
          {meta.outcomes.map(o => <button key={o} type="button" onClick={() => setOutcome(o)} className={chip(outcome === o)}>{OUTCOME_LABEL[o] || o}</button>)}
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-400 mb-1.5">Reason they gave (optional, pick any)</div>
        <div className="flex flex-wrap gap-1.5">
          {meta.reasons.map(r => <button key={r} type="button" onClick={() => toggle(r)} className={chip(reasons.includes(r))}>{REASON_LABEL[r] || r}</button>)}
        </div>
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What did they say? Their words are the most useful part."
        className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-primary"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-gray-400">
          Status after this
          <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary">
            <option value="">{currentStatus === 'new' ? 'Contacted (automatic)' : `Keep: ${STATUS_LABEL[currentStatus] || currentStatus}`}</option>
            {meta.statuses.filter(s => s !== 'new').map(s => <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Next follow-up (optional)
          <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} className="mt-1 w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary" />
        </label>
      </div>
      {err && <div className="text-xs text-red-300">{err}</div>}
      <button onClick={save} disabled={saving} className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary hover:bg-primary-accent text-white text-sm font-medium disabled:opacity-50">
        {saving ? 'Saving…' : 'Save response'}
      </button>
    </div>
  );
};

// ── Drawer ─────────────────────────────────────────────────────────────────

const LeadDrawer: React.FC<{ brandId: string; meta: Meta; onClose: () => void; onChanged: () => void }> = ({ brandId, meta, onClose, onChanged }) => {
  const navigate = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr('');
    try { setD(await api<Detail>(`/${brandId}`)); } catch (e: any) { setErr(e.message || 'Failed to load'); }
  }, [brandId]);
  useEffect(() => { setD(null); load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    try { await api(`/${brandId}`, { method: 'PATCH', body: JSON.stringify(body) }); await load(); onChanged(); }
    catch (e: any) { setErr(e.message || 'Could not save'); }
    finally { setBusy(false); }
  };
  const removeLog = async (id: string) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await api(`/logs/${id}`, { method: 'DELETE' }); await load(); onChanged(); }
    catch (e: any) { setErr(e.message || 'Could not delete'); }
  };
  const afterLog = async () => { await load(); onChanged(); };

  const lead = d?.lead;
  const canDelete = (l: LogEntry) => meta.me && (meta.me.type === 'super_admin' || meta.me._id === l.admin_id);
  const sel = 'bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary w-full';

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/50" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[560px] bg-dark-800 border-l border-dark-700 overflow-y-auto">
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700 px-4 sm:px-6 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="text-lg font-bold text-white truncate">{lead?.brand_name || 'Loading…'}</div>
            {lead && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Pill cls={STAGE_STYLES[lead.stage] || STAGE_STYLES.Browsing}>{lead.stage}</Pill>
                <Pill cls={STATUS_STYLES[lead.status]}>{STATUS_LABEL[lead.status]}</Pill>
                {!lead.is_active && <Pill cls="bg-red-500/10 text-red-300">Deactivated</Pill>}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-6">
          {err && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg text-sm">{err}</div>}
          {!d && !err && <div className="text-gray-500 text-sm">Loading…</div>}

          {d && lead && (
            <>
              {/* Lead controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-xs text-gray-400">Status
                  <select disabled={busy} value={lead.status} onChange={e => patch({ status: e.target.value })} className={`mt-1 ${sel}`}>
                    {meta.statuses.map(s => <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-400">Follow-up
                  <input disabled={busy} type="date" value={toInputDate(lead.next_follow_up)} onChange={e => patch({ next_follow_up: fromInputDate(e.target.value) })} className={`mt-1 ${sel}`} />
                </label>
                <label className="text-xs text-gray-400">Owner
                  <select disabled={busy} value={lead.owner || ''} onChange={e => patch({ owner: e.target.value || null })} className={`mt-1 ${sel}`}>
                    <option value="">Nobody</option>
                    {meta.admins.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                </label>
              </div>

              {/* Open money */}
              {lead.open && (
                <div className={`rounded-lg border px-4 py-3 ${lead.open.kind === 'offer' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                  <div className="text-xs uppercase tracking-wide text-gray-400">{lead.open.kind === 'offer' ? 'Accepted, not paid' : 'In cart'}</div>
                  <div className="text-xl font-bold text-white mt-0.5">{money(lead.open.amount, lead.open.currency)}</div>
                  {lead.open.kind === 'offer' && (
                    <div className="text-xs text-gray-300 mt-0.5">
                      {lead.open.count} offer{lead.open.count === 1 ? '' : 's'} · first pay window closes {fmtDateTime(lead.open.pay_by)} ({timeLeft(lead.open.pay_by)})
                    </div>
                  )}
                </div>
              )}

              {/* Contacts */}
              <section>
                <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Contact</h3>
                <div className="space-y-2">
                  {d.contacts.length === 0 && <div className="text-sm text-gray-500">{lead.email}</div>}
                  {d.contacts.map((c, i) => (
                    <div key={i} className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-sm">
                      <div className="text-white font-medium">{c.name || 'No name'}{c.designation ? <span className="text-gray-500 font-normal"> · {c.designation}</span> : null}</div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-gray-300 break-all">
                        {c.email && <a href={`mailto:${c.email}`} className="hover:text-primary">{c.email}</a>}
                        {c.phone && <a href={`tel:${c.phone}`} className="hover:text-primary">{c.phone}</a>}
                        {c.phone && <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-accent">WhatsApp ↗</a>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2 space-x-3">
                  <span>Signed up {fmtDate(lead.signed_up_at)}</span>
                  {lead.source && <span>via {lead.source}</span>}
                  {lead.city && <span>{lead.city}</span>}
                  {lead.website && <span>{lead.website}</span>}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                  <button onClick={() => navigate(`/brand-activity/${lead.brand_id}`)} className="text-primary hover:text-primary-accent">Activity timeline →</button>
                  <button onClick={() => navigate(`/brands/${lead.brand_id}`)} className="text-primary hover:text-primary-accent">Brand profile →</button>
                </div>
              </section>

              <LogForm brandId={lead.brand_id} meta={meta} currentStatus={lead.status} onSaved={afterLog} />

              {/* History */}
              <section>
                <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Responses ({d.logs.length})</h3>
                {d.logs.length === 0 && <div className="text-sm text-gray-500">No one has contacted this brand yet.</div>}
                <ol className="space-y-2">
                  {d.logs.map(l => (
                    <li key={l._id} className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-white">
                          <span className="font-medium">{OUTCOME_LABEL[l.outcome] || l.outcome}</span>
                          <span className="text-gray-500"> · {CHANNEL_LABEL[l.channel] || l.channel}</span>
                        </div>
                        {canDelete(l) && <button onClick={() => removeLog(l._id)} className="text-xs text-gray-500 hover:text-red-300">Delete</button>}
                      </div>
                      {l.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {l.reasons.map(r => <Pill key={r} cls="bg-primary/15 text-primary">{REASON_LABEL[r] || r}</Pill>)}
                        </div>
                      )}
                      {l.note && <p className="text-gray-300 mt-1.5 whitespace-pre-wrap break-words">{l.note}</p>}
                      <div className="text-xs text-gray-500 mt-1.5">{l.by} · {fmtDateTime(l.created_at)}</div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* Offers + orders */}
              <section>
                <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Requests and offers ({d.offers.length})</h3>
                {d.offers.length === 0 && <div className="text-sm text-gray-500">None yet.</div>}
                <ul className="divide-y divide-dark-700 bg-dark-900 border border-dark-700 rounded-lg">
                  {d.offers.map(o => (
                    <li key={o._id} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white truncate">{o.creator}{o.title ? <span className="text-gray-500"> · {o.title}</span> : null}</div>
                        <div className="text-xs text-gray-500">
                          {o.status}{o.status === 'accepted' && o.pay_by ? ` · pay by ${fmtDateTime(o.pay_by)} (${timeLeft(o.pay_by)})` : ''} · {fmtDate(o.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="tabular-nums text-gray-200">{money(o.amount, o.currency)}</span>
                        {o.chat_id && <button onClick={() => navigate(`/collabs/${o.chat_id}`)} className="text-xs text-primary hover:text-primary-accent">Chat →</button>}
                      </div>
                    </li>
                  ))}
                </ul>
                {d.orders.length > 0 && (
                  <div className="text-xs text-green-300 mt-2">{d.orders.length} paid order{d.orders.length === 1 ? '' : 's'}, {money(d.orders.reduce((s, o) => s + o.total, 0))} in total</div>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const Tile: React.FC<{ label: string; value: number | string; cls: string; onClick?: () => void; active?: boolean }> = ({ label, value, cls, onClick, active }) => (
  <button type="button" onClick={onClick} className={`text-left rounded-lg border px-4 py-3 transition-colors ${cls} ${active ? 'ring-2 ring-primary' : ''} ${onClick ? 'hover:brightness-125' : 'cursor-default'}`}>
    <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
    <div className="text-2xl font-bold mt-0.5">{value}</div>
  </button>
);

const Leads: React.FC = () => {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<'hot' | 'all'>('hot');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [due, setDue] = useState(false);
  const [never, setNever] = useState(false);
  const [sort, setSort] = useState('priority');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { api<Meta>('/meta').then(setMeta).catch(e => setError(e.message)); }, []);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const p = new URLSearchParams({ view, sort, page: String(page), limit: '25' });
      if (stage) p.set('stage', stage);
      if (status) p.set('status', status);
      if (reason) p.set('reason', reason);
      if (due) p.set('due', '1');
      if (never) p.set('never', '1');
      if (q) p.set('search', q);
      setData(await api<ListResponse>(`?${p}`));
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [view, stage, status, reason, due, never, sort, page, q]);
  useEffect(() => { fetchList(); }, [fetchList]);

  const reset = (fn: () => void) => { fn(); setPage(1); };
  const s = data?.summary;
  const items = data?.items || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const ctl = 'bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary';

  return (
    <div className="text-gray-100">
      <div className="mb-5">
        <h1 className="text-2xl font-bold mb-1">Leads</h1>
        <p className="text-sm text-gray-400">Brands to follow up with. Stage updates by itself; log every call or message so we learn what brands want.</p>
      </div>

      {/* Summary */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Tile label="Follow-ups due" value={s.due_today} cls="bg-red-500/10 border-red-500/30 text-red-300" active={due} onClick={() => reset(() => setDue(!due))} />
          <Tile label="Hot, never contacted" value={s.hot_never_contacted} cls="bg-amber-500/10 border-amber-500/30 text-amber-300" active={never && view === 'hot'} onClick={() => reset(() => { setNever(!never); setView('hot'); })} />
          <Tile label="Awaiting payment" value={s.by_stage['Awaiting payment'] || 0} cls="bg-purple-500/10 border-purple-500/30 text-purple-300" active={stage === 'Awaiting payment'} onClick={() => reset(() => setStage(stage === 'Awaiting payment' ? '' : 'Awaiting payment'))} />
          <Tile label="Relevant" value={s.by_status.relevant || 0} cls="bg-primary/10 border-primary/30 text-primary" active={status === 'relevant'} onClick={() => reset(() => setStatus(status === 'relevant' ? '' : 'relevant'))} />
        </div>
      )}
      {s && s.top_reasons_30d.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="text-gray-400">Top reasons, last 30 days:</span>
          {s.top_reasons_30d.map(r => (
            <button key={r.reason} onClick={() => reset(() => setReason(reason === r.reason ? '' : r.reason))}
              className={`px-2.5 py-1 rounded-full border ${reason === r.reason ? 'bg-primary border-primary text-white' : 'border-dark-600 text-gray-300 hover:border-primary'}`}>
              {REASON_LABEL[r.reason] || r.reason} · {r.count}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1">
          {(['hot', 'all'] as const).map(v => (
            <button key={v} onClick={() => reset(() => setView(v))} className={`px-3 py-1 rounded text-xs font-medium ${view === v ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
              {v === 'hot' ? 'Cart and above' : `All brands${s ? ` (${s.total})` : ''}`}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search brand, email, phone…" className={`${ctl} flex-1 min-w-[180px] placeholder-gray-500`} />
        <select value={stage} onChange={e => reset(() => setStage(e.target.value))} className={ctl}>
          <option value="">Any stage</option>
          {(meta?.stages || []).map(x => <option key={x} value={x}>{x}{s ? ` (${s.by_stage[x] || 0})` : ''}</option>)}
        </select>
        <select value={status} onChange={e => reset(() => setStatus(e.target.value))} className={ctl}>
          <option value="">Any status</option>
          {(meta?.statuses || []).map(x => <option key={x} value={x}>{STATUS_LABEL[x] || x}{s ? ` (${s.by_status[x] || 0})` : ''}</option>)}
        </select>
        <select value={reason} onChange={e => reset(() => setReason(e.target.value))} className={ctl}>
          <option value="">Any reason</option>
          {(meta?.reasons || []).map(x => <option key={x} value={x}>{REASON_LABEL[x] || x}</option>)}
        </select>
        <select value={sort} onChange={e => reset(() => setSort(e.target.value))} className={ctl}>
          <option value="priority">Most urgent first</option>
          <option value="follow_up">Follow-up date</option>
          <option value="last_contact">Last contacted</option>
          <option value="last_active">Recently active</option>
          <option value="signup">Newest signup</option>
        </select>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {loading && <div className="text-center text-gray-500 py-8">Loading…</div>}
        {!loading && items.length === 0 && <div className="text-center text-gray-500 py-8">No brands match these filters.</div>}
        {!loading && items.map(r => (
          <button key={r.brand_id} onClick={() => setOpenId(r.brand_id)} className="w-full text-left bg-dark-800 border border-dark-700 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-white truncate">{r.brand_name}</div>
              <Pill cls={STATUS_STYLES[r.status]}>{STATUS_LABEL[r.status]}</Pill>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
              <Pill cls={STAGE_STYLES[r.stage] || STAGE_STYLES.Browsing}>{r.stage}</Pill>
              {r.open && <span className="text-gray-200">{money(r.open.amount, r.open.currency)}</span>}
              {r.open?.kind === 'offer' && <span className="text-red-300">{timeLeft(r.open.pay_by)}</span>}
              {isDue(r.next_follow_up) && r.status !== 'won' && <span className="text-red-300">Follow-up due</span>}
            </div>
            <div className="text-xs text-gray-500 mt-1.5 truncate">
              {r.last_log ? `${OUTCOME_LABEL[r.last_log.outcome]}: ${r.last_log.note || CHANNEL_LABEL[r.last_log.channel]} · ${timeAgo(r.last_log.at)}` : 'Not contacted yet'}
            </div>
          </button>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Brand</th>
                <th className="text-left px-4 py-3 font-medium">Stage</th>
                <th className="text-right px-4 py-3 font-medium">Open value</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Last response</th>
                <th className="text-left px-4 py-3 font-medium">Follow-up</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No brands match these filters.</td></tr>}
              {!loading && items.map(r => (
                <tr key={r.brand_id} onClick={() => setOpenId(r.brand_id)} className="hover:bg-dark-700/40 cursor-pointer">
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="font-medium text-white truncate">{r.brand_name}</div>
                    <div className="text-xs text-gray-500 truncate">{r.phone || r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Pill cls={STAGE_STYLES[r.stage] || STAGE_STYLES.Browsing}>{r.stage}</Pill>
                    {r.last_active && <div className="text-xs text-gray-500 mt-1">active {timeAgo(r.last_active)}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.open ? <div className="text-gray-200">{money(r.open.amount, r.open.currency)}</div> : <span className="text-gray-600">—</span>}
                    {r.open?.kind === 'offer' && <div className="text-xs text-red-300">{timeLeft(r.open.pay_by)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Pill cls={STATUS_STYLES[r.status]}>{STATUS_LABEL[r.status]}</Pill>
                    {r.owner_name && <div className="text-xs text-gray-500 mt-1">{r.owner_name}</div>}
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    {r.last_log ? (
                      <>
                        <div className="text-gray-200 truncate">{OUTCOME_LABEL[r.last_log.outcome]}{r.last_log.note ? `: ${r.last_log.note}` : ''}</div>
                        <div className="text-xs text-gray-500">{CHANNEL_LABEL[r.last_log.channel]} · {timeAgo(r.last_log.at)} · {r.last_log.by}</div>
                      </>
                    ) : <span className="text-gray-500">Not contacted yet</span>}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${isDue(r.next_follow_up) && !['won', 'lost', 'not_interested'].includes(r.status) ? 'text-red-300 font-medium' : 'text-gray-300'}`}>
                    {fmtDate(r.next_follow_up) || <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{r.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <div>{(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}</div>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 rounded bg-dark-700 disabled:opacity-30 hover:bg-dark-600">Prev</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded bg-dark-700 disabled:opacity-30 hover:bg-dark-600">Next</button>
          </div>
        </div>
      )}

      {openId && meta && <LeadDrawer brandId={openId} meta={meta} onClose={() => setOpenId(null)} onChanged={fetchList} />}
    </div>
  );
};

export default Leads;
