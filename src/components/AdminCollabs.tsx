// AdminCollabs — every Direct Message conversation (brand ↔ creator) across
// the platform: who messaged whom, what was offered, where the deal stands.
//
// Data: POST /admin/collabs/list { page, limit, stage?, q? }. Read-only.
// Click a row → /collabs/:chatId (full timeline, chat, offers, money).

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import collabs from '../config/collabs';

interface Party { _id: string; name?: string; username?: string; email?: string; profile_image?: string }
interface CollabRow {
    chat_id: string;
    stage: 'request' | 'talking' | 'negotiating' | 'awaiting_payment' | 'paid' | 'closed';
    brand: Party | null;
    creator: Party | null;
    latest_offer: { status: string; amount: number; currency?: string; proposed_by?: string; deliverables_summary?: string; pay_by?: string; order_id?: string | null };
    offers: number;
    paid_orders: number;
    started_at?: string;
    last_activity_at?: string;
}

export const STAGE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
    request:          { label: 'Request (no reply)', bg: 'bg-amber-500/15',   text: 'text-amber-300' },
    talking:          { label: 'Talking',            bg: 'bg-sky-500/15',     text: 'text-sky-300' },     // creator replied, no counter-offer yet
    negotiating:      { label: 'Negotiating',        bg: 'bg-violet-500/15',  text: 'text-violet-300' },  // a counter-offer is pending
    awaiting_payment: { label: 'Awaiting payment',   bg: 'bg-blue-500/15',    text: 'text-blue-300' },
    paid:             { label: 'Paid',               bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
    closed:           { label: 'Closed',             bg: 'bg-gray-500/15',    text: 'text-gray-300' },
};

const TABS: { key: string; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'request', label: 'Requests' },
    { key: 'talking', label: 'Talking' },
    { key: 'negotiating', label: 'Negotiating' },
    { key: 'awaiting_payment', label: 'Awaiting payment' },
    { key: 'paid', label: 'Paid' },
    { key: 'closed', label: 'Closed' },
];

export function formatPKR(n?: number | string, currency = 'PKR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return `${currency} ${v.toLocaleString('en-US')}`;
}
export function formatDateTime(s?: string) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

const Avatar: React.FC<{ p: Party | null }> = ({ p }) => (
    p?.profile_image
        ? <img src={p.profile_image} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
        : <div className="w-8 h-8 rounded-full bg-dark-700 text-gray-300 flex items-center justify-center text-xs font-bold flex-shrink-0">{(p?.name || '?')[0]?.toUpperCase()}</div>
);

const AdminCollabs: React.FC = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<CollabRow[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stage, setStage] = useState('');
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const LIMIT = 25;

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { setPage(1); }, [stage, debouncedQ]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await collabs.post('/admin/collabs/list', { page, limit: LIMIT, ...(stage ? { stage } : {}), ...(debouncedQ ? { q: debouncedQ } : {}) });
                if (cancelled) return;
                setRows(res?.data?.data?.collabs || []);
                setCounts(res?.data?.data?.counts || {});
                setTotal(res?.data?.data?.pagination?.total_count || 0);
            } catch (err: any) {
                if (!cancelled) setError(err?.response?.data?.message || 'Failed to load collabs.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [page, stage, debouncedQ]);

    const pages = Math.max(1, Math.ceil(total / LIMIT));

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-white">Collabs</h1>
                <p className="text-sm text-gray-400 mt-1">Direct Message conversations: who messaged whom, every offer, and where each deal stands.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {TABS.map(t => (
                    <button
                        key={t.key || 'all'}
                        onClick={() => setStage(t.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${stage === t.key ? 'bg-primary text-white' : 'bg-dark-800 text-gray-300 hover:bg-dark-700'}`}
                    >
                        {t.label} <span className="opacity-70">({t.key ? counts[t.key] || 0 : counts.all || 0})</span>
                    </button>
                ))}
                <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Search brand, creator, email…"
                    className="ml-auto w-full sm:w-72 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-primary"
                />
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">{error}</div>}

            <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-dark-700">
                                <th className="px-4 py-3">Brand</th>
                                <th className="px-4 py-3">Creator</th>
                                <th className="px-4 py-3">Stage</th>
                                <th className="px-4 py-3">Latest offer</th>
                                <th className="px-4 py-3 text-right">Offers</th>
                                <th className="px-4 py-3">Last activity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rows.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Loading…</td></tr>
                            )}
                            {!loading && rows.length === 0 && (
                                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No collab conversations yet.</td></tr>
                            )}
                            {rows.map(r => {
                                const st = STAGE_STYLES[r.stage] || STAGE_STYLES.closed;
                                return (
                                    <tr key={r.chat_id} onClick={() => navigate(`/collabs/${r.chat_id}`)} className="border-b border-dark-700/60 hover:bg-dark-700/40 cursor-pointer">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5 min-w-[160px]">
                                                <Avatar p={r.brand} />
                                                <div className="min-w-0">
                                                    <div className="text-gray-100 font-semibold truncate">{r.brand?.name || '—'}</div>
                                                    <div className="text-[11px] text-gray-500 truncate">{r.brand?.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5 min-w-[160px]">
                                                <Avatar p={r.creator} />
                                                <div className="min-w-0">
                                                    <div className="text-gray-100 font-semibold truncate">{r.creator?.name || '—'}</div>
                                                    <div className="text-[11px] text-gray-500 truncate">@{r.creator?.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span></td>
                                        <td className="px-4 py-3">
                                            <div className="text-emerald-300 font-mono">{formatPKR(r.latest_offer.amount, r.latest_offer.currency)}</div>
                                            <div className="text-[11px] text-gray-500 truncate max-w-[260px]">{r.latest_offer.deliverables_summary} · by {r.latest_offer.proposed_by === 'influencer' ? 'creator' : 'brand'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-300">{r.offers}{r.paid_orders ? <span className="text-emerald-400"> · {r.paid_orders} paid</span> : null}</td>
                                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(r.last_activity_at)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {pages > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded bg-dark-800 text-gray-300 disabled:opacity-40">Previous</button>
                    <span className="text-gray-400">Page {page} of {pages}</span>
                    <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded bg-dark-800 text-gray-300 disabled:opacity-40">Next</button>
                </div>
            )}
        </div>
    );
};

export default AdminCollabs;
