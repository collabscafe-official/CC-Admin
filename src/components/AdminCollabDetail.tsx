// AdminCollabDetail — one Direct Message conversation, end to end.
//
// Left: merged timeline (offers, replies, reminders, payment, brief,
// deliverables, approvals). Middle: full read-only chat (shared viewer from
// AdminOrderDetail, renders offer cards). Right: every offer with status and
// the money breakdown, plus links to the paid orders.
//
// Data: POST /admin/collabs/get { chat_id }, POST /admin/chats/messages. Read-only.

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import collabs from '../config/collabs';
import { ChatHistoryViewer } from './AdminOrderDetail';
import { STAGE_STYLES, formatPKR, formatDateTime } from './AdminCollabs';

interface Party { _id: string; name?: string; username?: string; email?: string; profile_image?: string; city?: string; country?: string; min_budget?: number | null }
interface Offer {
    _id: string; proposed_by: 'brand' | 'creator'; is_request: boolean; status: string;
    note?: string; deliverables_summary?: string; amount: number; currency?: string; deadline_days?: number;
    created_at?: string; responded_at?: string; expires_at?: string; pay_by?: string; reminded_at?: string; declined_reason?: string;
    order_id?: string | null;
    payment_due?: { amount?: string; currency?: string } | null;
    platform_fee?: { amount?: string; percentage?: string } | null;
}
interface OrderOut {
    _id: string; fulfillment_status?: string; paid_at?: string;
    total?: { amount?: string; currency?: string }; platform_fee?: { amount?: string; percentage?: string }; subtotal?: { amount?: string };
    payment?: { method?: string; issuer?: string; masked_pan?: string; transaction_id?: string; amount?: string } | null;
    brief?: { sent_at?: string; anything_else?: string } | null;
    items: { _id: string; title?: string; amount?: string; fulfillment_status?: string; revision_count?: number; approved_at?: string; submissions: { type: string; submitted_at: string; deliverable_url?: string }[] }[];
}
interface TimelineEvent { at: string; kind: string; actor: 'brand' | 'creator' | 'system'; text: string }
interface Detail {
    chat_id: string; stage: string; brand: Party | null; creator: Party | null;
    offers: Offer[]; orders: OrderOut[]; timeline: TimelineEvent[]; first_creator_reply_at?: string | null; chat_available: boolean;
}

const OFFER_STATUS: Record<string, string> = {
    pending: 'text-amber-300', accepted: 'text-emerald-300', declined: 'text-red-300',
    cancelled: 'text-gray-400', superseded: 'text-gray-500', expired: 'text-gray-400',
};
const ACTOR_DOT: Record<string, string> = { brand: 'bg-primary', creator: 'bg-violet-400', system: 'bg-gray-500' };

function hoursBetween(a?: string, b?: string | null) {
    if (!a || !b) return null;
    const h = (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
    return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(h < 10 ? 1 : 0)} h`;
}

const AdminCollabDetail: React.FC = () => {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const [d, setD] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await collabs.post('/admin/collabs/get', { chat_id: chatId });
                if (!cancelled) setD(res?.data?.data || null);
            } catch (err: any) {
                if (!cancelled) setError(err?.response?.data?.message || 'Failed to load collab.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [chatId]);

    if (loading) return <div className="text-gray-400 py-10 text-center">Loading…</div>;
    if (error || !d) return (
        <div className="space-y-3">
            <button onClick={() => navigate('/collabs')} className="text-sm text-gray-400 hover:text-white">← All collabs</button>
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">{error || 'Not found'}</div>
        </div>
    );

    const st = STAGE_STYLES[d.stage] || STAGE_STYLES.closed;
    const request = d.offers.find(o => o.is_request);
    const replyTime = hoursBetween(request?.created_at, d.first_creator_reply_at);
    const brandForChat = d.brand ? { _id: d.brand._id, brand_name: d.brand.name, email: d.brand.email, profile_image: d.brand.profile_image } : null;
    const creatorForChat = d.creator ? { _id: d.creator._id, name: d.creator.name, username: d.creator.username, profile_image: d.creator.profile_image } : undefined;

    return (
        <div className="space-y-5">
            <button onClick={() => navigate('/collabs')} className="text-sm text-gray-400 hover:text-white">← All collabs</button>

            {/* Header */}
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex flex-wrap items-center gap-6">
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Brand</div>
                    <a href={`/brands/${d.brand?._id}`} className="text-white font-semibold hover:text-primary">{d.brand?.name || '—'}</a>
                    <div className="text-xs text-gray-500">{d.brand?.email}{d.brand?.city ? ` · ${d.brand.city}` : ''}</div>
                </div>
                <div className="text-gray-600 text-xl">↔</div>
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Creator</div>
                    <a href={`/influencers/${d.creator?._id}`} className="text-white font-semibold hover:text-primary">{d.creator?.name || '—'}</a>
                    <div className="text-xs text-gray-500">@{d.creator?.username}{d.creator?.min_budget ? ` · min ${formatPKR(d.creator.min_budget)}` : ''}</div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                    <div className="text-gray-400">Offers <span className="text-white font-semibold">{d.offers.length}</span></div>
                    <div className="text-gray-400">Paid orders <span className="text-white font-semibold">{d.orders.length}</span></div>
                    <div className="text-gray-400">First reply <span className="text-white font-semibold">{replyTime || (d.first_creator_reply_at === null ? 'none yet' : '—')}</span></div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_340px] gap-5 items-start">
                {/* Timeline */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                    <div className="text-sm font-bold text-white mb-3">Timeline</div>
                    {!d.chat_available && <div className="text-[11px] text-amber-300/80 mb-3">Chat service unreachable: chat-side events (first reply, revisions) not included.</div>}
                    <ol className="space-y-3">
                        {d.timeline.map((e, i) => (
                            <li key={i} className="flex gap-3">
                                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${ACTOR_DOT[e.actor] || 'bg-gray-500'}`} />
                                <div className="min-w-0">
                                    <div className="text-xs text-gray-200 break-words">{e.text}</div>
                                    <div className="text-[10px] text-gray-500">{formatDateTime(e.at)} · {e.actor}</div>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Chat */}
                <ChatHistoryViewer chatId={d.chat_id} brand={brandForChat as any} creator={creatorForChat as any} />

                {/* Offers + money */}
                <div className="space-y-4">
                    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                        <div className="text-sm font-bold text-white mb-3">Offers</div>
                        <div className="space-y-3">
                            {d.offers.map(o => (
                                <div key={o._id} className="bg-dark-900/60 border border-dark-700 rounded-lg p-3">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-gray-400 font-semibold uppercase tracking-wide">{o.is_request ? 'Request' : 'Offer'} · by {o.proposed_by}</span>
                                        <span className={`font-semibold ${OFFER_STATUS[o.status] || 'text-gray-300'}`}>{o.order_id ? 'paid' : o.status}</span>
                                    </div>
                                    {o.note && <div className="text-xs text-gray-300 mt-1.5 whitespace-pre-wrap line-clamp-4">{o.note}</div>}
                                    <div className="text-xs text-gray-200 mt-1.5">{o.deliverables_summary}</div>
                                    <div className="text-sm text-emerald-300 font-mono font-bold mt-1">{formatPKR(o.amount, o.currency)}</div>
                                    {o.payment_due?.amount && (
                                        <div className="text-[11px] text-gray-400 mt-1">
                                            Fee {o.platform_fee?.percentage || 20}%: {formatPKR(o.platform_fee?.amount)} · Brand pays {formatPKR(o.payment_due.amount)}
                                        </div>
                                    )}
                                    <div className="text-[10px] text-gray-500 mt-1.5">
                                        Sent {formatDateTime(o.created_at)}
                                        {o.responded_at ? ` · ${o.status} ${formatDateTime(o.responded_at)}` : ''}
                                        {o.pay_by && !o.order_id ? ` · pay by ${formatDateTime(o.pay_by)}` : ''}
                                    </div>
                                    {o.declined_reason && <div className="text-[11px] text-red-300/80 mt-1 italic">“{o.declined_reason}”</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {d.orders.map(o => (
                        <div key={o._id} className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-white">Order</span>
                                <a href={`/orders/${o._id}`} className="text-xs text-primary hover:underline font-mono">#{String(o._id).slice(-8).toUpperCase()} →</a>
                            </div>
                            <div className="text-xs text-gray-400">Status <span className="text-gray-200">{o.fulfillment_status}</span> · Paid {formatDateTime(o.paid_at)}</div>
                            <div className="text-xs space-y-1">
                                <div className="flex justify-between"><span className="text-gray-400">Creator earns</span><span className="text-gray-200 font-mono">{formatPKR(o.subtotal?.amount)}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Platform fee ({o.platform_fee?.percentage || 20}%)</span><span className="text-gray-200 font-mono">{formatPKR(o.platform_fee?.amount)}</span></div>
                                <div className="flex justify-between border-t border-dark-700 pt-1"><span className="text-gray-300 font-semibold">Brand paid</span><span className="text-emerald-300 font-mono font-bold">{formatPKR(o.total?.amount, o.total?.currency)}</span></div>
                            </div>
                            {o.payment && (
                                <div className="text-[11px] text-gray-500">{[o.payment.method, o.payment.issuer, o.payment.masked_pan].filter(Boolean).join(' · ')} · PayFast {o.payment.transaction_id}</div>
                            )}
                            {o.items.map(i => (
                                <div key={i._id} className="text-[11px] text-gray-400">
                                    {i.title}: <span className="text-gray-200">{i.fulfillment_status}</span>
                                    {i.submissions.length ? ` · ${i.submissions.length} submission${i.submissions.length > 1 ? 's' : ''}` : ''}
                                    {i.revision_count ? ` · ${i.revision_count} revision${i.revision_count > 1 ? 's' : ''}` : ''}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminCollabDetail;
