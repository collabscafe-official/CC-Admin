// AdminCustomOffers — every brand-sent custom offer across the platform.
//
// Data: POST /admin/custom-offers/list. Filter by status via tabs, search by
// offer title via the search box. Each row expands inline to show full
// campaign details (brief, deliverables, expiry, decline reason if any, cart
// + order linkage). Read-only — admins can't edit offers; the lifecycle is
// driven by brand + creator actions.

import React, { useEffect, useMemo, useState } from 'react';
import collabs from '../config/collabs';

// ── Types ────────────────────────────────────────────────────────────────────

interface Deliverable {
    platform?: string;
    content_deliverable?: string;
    qty?: number;
    deadline?: string;
}

interface BrandRef {
    _id: string;
    brand_name?: string;
    email?: string;
    profile_image?: string;
}

interface CreatorRef {
    _id: string;
    name?: string;
    username?: string;
    email?: string;
    profile_image?: string;
}

interface CustomOffer {
    _id: string;
    brand?: BrandRef;
    influencer?: CreatorRef;
    title: string;
    description?: string;
    deliverables?: Deliverable[];
    amount: number;
    currency: string;
    expires_at?: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
    declined_reason?: string;
    responded_at?: string;
    cancelled_at?: string;
    cart_id?: string;
    order_id?: string;
    created_at?: string;
    cart_summary?: {
        payment_due?: { amount?: string; currency?: string };
        platform_fee?: { amount?: string; percentage?: string };
        line_items_subtotal?: { amount?: string };
        is_order_created?: boolean;
    };
    order_summary?: {
        total?: { amount?: string; currency?: string };
        fulfillment_status?: string;
        created_date?: string;
    };
}

interface Counts {
    all: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
    cancelled: number;
}

// ── Status pill mapping ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
    pending:   { label: 'Pending',   bg: 'bg-amber-500/15',   text: 'text-amber-300' },
    accepted:  { label: 'Accepted',  bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
    declined:  { label: 'Declined',  bg: 'bg-red-500/15',     text: 'text-red-300' },
    expired:   { label: 'Expired',   bg: 'bg-gray-500/15',    text: 'text-gray-300' },
    cancelled: { label: 'Cancelled', bg: 'bg-gray-500/15',    text: 'text-gray-300' },
};

const STATUS_TABS: { key: string; label: string }[] = [
    { key: '',          label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'accepted',  label: 'Accepted' },
    { key: 'declined',  label: 'Declined' },
    { key: 'expired',   label: 'Expired' },
    { key: 'cancelled', label: 'Cancelled' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id?: string) {
    if (!id) return '—';
    return '#' + String(id).slice(-8).toUpperCase();
}

function formatDateTime(s?: string) {
    if (!s) return '—';
    try {
        return new Date(s).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch { return '—'; }
}

function formatDate(s?: string) {
    if (!s) return '—';
    try {
        return new Date(s).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch { return '—'; }
}

function formatPKR(amount: number | string | undefined) {
    if (amount === null || amount === undefined) return '—';
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    return 'Rs ' + n.toLocaleString('en-PK');
}

function initials(name?: string) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ── Avatar (image with initial fallback) ─────────────────────────────────────

const AVATAR_BG = ['#079F82', '#7B6AAD', '#F59E0B', '#3B82F6', '#EF4444'];
function avatarBg(seed?: string) {
    if (!seed) return AVATAR_BG[0];
    return AVATAR_BG[seed.charCodeAt(0) % AVATAR_BG.length];
}

const Avatar: React.FC<{ src?: string; name?: string; size?: number }> = ({ src, name, size = 32 }) => {
    const [failed, setFailed] = useState(false);
    if (src && !failed) {
        return (
            <img
                src={src}
                alt={name || ''}
                className="rounded-full object-cover flex-shrink-0"
                style={{ width: size, height: size }}
                onError={() => setFailed(true)}
            />
        );
    }
    return (
        <div
            className="rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
            style={{ width: size, height: size, background: avatarBg(name), fontSize: size * 0.4 }}
        >
            {initials(name)}
        </div>
    );
};

// ── Expanded detail panel ────────────────────────────────────────────────────

const ExpandedDetail: React.FC<{ offer: CustomOffer }> = ({ offer }) => {
    const cart = offer.cart_summary;
    const order = offer.order_summary;
    return (
        <div className="bg-dark-900/50 border-t border-dark-700 px-5 py-5 space-y-5">
            {/* Description / Brief */}
            <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">
                    What the brand wants
                </div>
                {offer.description ? (
                    <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{offer.description}</p>
                ) : (
                    <p className="text-sm text-gray-500 italic">No brief provided</p>
                )}
            </div>

            {/* Deliverables */}
            <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">
                    Deliverables ({offer.deliverables?.length || 0})
                </div>
                {(offer.deliverables?.length || 0) > 0 ? (
                    <div className="space-y-1.5">
                        {offer.deliverables!.map((d, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-dark-800 rounded-lg px-3 py-2 text-sm">
                                <span className="text-primary font-bold uppercase text-[11px] tracking-wide min-w-[80px]">
                                    {d.platform || '—'}
                                </span>
                                <span className="text-gray-200 flex-1 truncate">{d.content_deliverable || '—'}</span>
                                {d.qty && d.qty > 1 && <span className="text-gray-400 text-xs">× {d.qty}</span>}
                                {d.deadline && (
                                    <span className="text-xs text-gray-300 bg-dark-700 px-2 py-0.5 rounded">
                                        {d.deadline}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic">No deliverables listed</p>
                )}
            </div>

            {/* Timeline + money grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Sent</div>
                    <div className="text-xs text-gray-200">{formatDateTime(offer.created_at)}</div>
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Expires</div>
                    <div className="text-xs text-gray-200">{formatDateTime(offer.expires_at)}</div>
                </div>
                {offer.responded_at && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">
                            {offer.status === 'accepted' ? 'Accepted' : offer.status === 'declined' ? 'Declined' : 'Responded'}
                        </div>
                        <div className="text-xs text-gray-200">{formatDateTime(offer.responded_at)}</div>
                    </div>
                )}
                {offer.cancelled_at && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Cancelled</div>
                        <div className="text-xs text-gray-200">{formatDateTime(offer.cancelled_at)}</div>
                    </div>
                )}
            </div>

            {/* Money breakdown */}
            <div className="bg-dark-800 rounded-lg p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Offer amount (creator earns)</span>
                    <span className="text-gray-200 font-mono">{formatPKR(offer.amount)}</span>
                </div>
                {cart?.platform_fee?.amount && (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Platform fee ({cart.platform_fee.percentage || '20'}%)</span>
                        <span className="text-gray-200 font-mono">{formatPKR(cart.platform_fee.amount)}</span>
                    </div>
                )}
                {cart?.payment_due?.amount && (
                    <div className="flex justify-between text-sm pt-1.5 border-t border-dark-700">
                        <span className="text-gray-300 font-semibold">Brand pays (all-in)</span>
                        <span className="text-emerald-300 font-mono font-bold">{formatPKR(cart.payment_due.amount)}</span>
                    </div>
                )}
            </div>

            {/* Decline reason if any */}
            {offer.status === 'declined' && offer.declined_reason && (
                <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">
                        Decline reason (creator-only, not shared with brand)
                    </div>
                    <p className="text-sm text-red-300/90 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 italic whitespace-pre-wrap">
                        {offer.declined_reason}
                    </p>
                </div>
            )}

            {/* Linkage to cart + order */}
            <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                {offer.cart_id && (
                    <div>
                        <span className="text-gray-500">Cart ID:</span>{' '}
                        <span className="font-mono text-gray-300">{shortId(offer.cart_id)}</span>
                        {cart?.is_order_created ? (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 font-semibold">PAID</span>
                        ) : (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 font-semibold">AWAITING PAYMENT</span>
                        )}
                    </div>
                )}
                {offer.order_id && (
                    <div>
                        <span className="text-gray-500">Order ID:</span>{' '}
                        <a
                            href={`/orders/${offer.order_id}`}
                            className="font-mono text-primary hover:underline"
                        >
                            {shortId(offer.order_id)}
                        </a>
                        {order?.fulfillment_status && (
                            <span className="ml-1.5 text-gray-400">· {order.fulfillment_status}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Main component ───────────────────────────────────────────────────────────

const AdminCustomOffers: React.FC = () => {
    const [offers, setOffers] = useState<CustomOffer[]>([]);
    const [counts, setCounts] = useState<Counts>({ all: 0, pending: 0, accepted: 0, declined: 0, expired: 0, cancelled: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
    const [detailCache, setDetailCache] = useState<Record<string, CustomOffer>>({});
    const LIMIT = 25;

    // Debounce the search box
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(searchQ.trim()), 300);
        return () => clearTimeout(t);
    }, [searchQ]);

    useEffect(() => {
        let cancelled = false;
        const fetchOffers = async () => {
            setLoading(true);
            setError(null);
            try {
                const body: Record<string, any> = {};
                if (statusFilter) body.status = statusFilter;
                if (debouncedQ) body.q = debouncedQ;
                const res = await collabs.post('/admin/custom-offers/list', body, {
                    params: { page, limit: LIMIT },
                });
                if (cancelled) return;
                if (res?.data?.success && res?.data?.data) {
                    setOffers(res.data.data.offers || []);
                    setCounts(res.data.data.counts || counts);
                    setTotalCount(res.data.data.pagination?.total_count || 0);
                } else {
                    setOffers([]);
                    setTotalCount(0);
                }
            } catch (err: any) {
                if (cancelled) return;
                if (err?.response?.status === 404) {
                    setOffers([]);
                    setTotalCount(0);
                } else {
                    setError('Failed to load custom offers.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchOffers();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, statusFilter, debouncedQ]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / LIMIT)), [totalCount]);

    // Click a row → toggle expand + lazy-fetch detail (for cart/order summary).
    const handleToggleExpand = async (offer: CustomOffer) => {
        const id = offer._id;
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(id);
        if (detailCache[id]) return; // already fetched
        setDetailLoadingId(id);
        try {
            const res = await collabs.post('/admin/custom-offers/get', { id });
            if (res?.data?.success && res?.data?.data) {
                setDetailCache(prev => ({ ...prev, [id]: res.data.data }));
            }
        } catch {
            // Silently fall back to list row data — we have enough to display
        } finally {
            setDetailLoadingId(null);
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Custom Offers</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Every brand-sent custom offer across the platform. Click a row to see the brief + deliverables.
                    </p>
                </div>
                <div className="text-sm text-gray-400">
                    {loading ? '…' : `${totalCount.toLocaleString()} ${statusFilter || 'total'}`}
                </div>
            </div>

            {/* Status tabs */}
            <div className="flex flex-wrap gap-2 items-center">
                {STATUS_TABS.map(t => {
                    const isActive = statusFilter === t.key;
                    const tabCount = t.key === '' ? counts.all : (counts as any)[t.key] || 0;
                    return (
                        <button
                            key={t.key || 'all'}
                            onClick={() => { setStatusFilter(t.key); setPage(1); setExpandedId(null); }}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                                isActive
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-dark-800 text-gray-400 border-dark-700 hover:border-primary hover:text-primary'
                            }`}
                        >
                            {t.label}
                            {tabCount > 0 && (
                                <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    isActive ? 'bg-white/20' : 'bg-dark-700'
                                }`}>
                                    {tabCount}
                                </span>
                            )}
                        </button>
                    );
                })}
                {/* Search */}
                <div className="ml-auto">
                    <input
                        type="text"
                        placeholder="Search title..."
                        value={searchQ}
                        onChange={(e) => { setSearchQ(e.target.value); setPage(1); }}
                        className="bg-dark-800 border border-dark-700 text-gray-200 placeholder-gray-500 rounded-lg px-3 py-1.5 text-sm focus:border-primary focus:outline-none w-56"
                    />
                </div>
            </div>

            {/* Error banner */}
            {error && !loading && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* Offers list */}
            <div className="space-y-3">
                {loading && Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-dark-800 rounded-xl border border-dark-700 px-5 py-4">
                        <div className="h-4 w-48 bg-dark-700 animate-pulse rounded mb-3" />
                        <div className="h-3 w-3/4 bg-dark-700 animate-pulse rounded" />
                    </div>
                ))}

                {!loading && offers.length === 0 && !error && (
                    <div className="bg-dark-800 rounded-xl border border-dark-700 px-5 py-12 text-center text-gray-500 text-sm">
                        No {statusFilter || ''} custom offers{debouncedQ ? ` matching "${debouncedQ}"` : ''}.
                    </div>
                )}

                {!loading && offers.map(o => {
                    const status = STATUS_STYLES[o.status] || { label: o.status, bg: 'bg-gray-500/15', text: 'text-gray-300' };
                    const brandName = o.brand?.brand_name || 'Unknown brand';
                    const creatorName = o.influencer?.name || o.influencer?.username || 'Unknown creator';
                    const isExpanded = expandedId === o._id;
                    const fullOffer = detailCache[o._id] || o;
                    return (
                        <div
                            key={o._id}
                            className={`bg-dark-800 rounded-xl border transition-colors overflow-hidden ${
                                isExpanded
                                    ? 'border-primary/40'
                                    : 'border-dark-700 hover:border-primary/40'
                            }`}
                        >
                            {/* Header row — always visible, click to toggle */}
                            <button
                                type="button"
                                onClick={() => handleToggleExpand(o)}
                                className="w-full text-left px-5 py-4 cursor-pointer hover:bg-dark-700/40 transition-colors"
                            >
                                <div className="flex items-center gap-4 flex-wrap">
                                    {/* Brand → Creator */}
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <Avatar src={o.brand?.profile_image} name={brandName} size={36} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{brandName}</div>
                                            <div className="text-xs text-gray-500 truncate">{o.brand?.email || '—'}</div>
                                        </div>

                                        <i className="fas fa-arrow-right text-gray-600 mx-1" />

                                        <Avatar src={o.influencer?.profile_image} name={creatorName} size={36} />
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{creatorName}</div>
                                            <div className="text-xs text-gray-500 truncate">
                                                {o.influencer?.username ? `@${o.influencer.username}` : (o.influencer?.email || '—')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Title + amount + status */}
                                    <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-gray-200 truncate max-w-[220px]">{o.title}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{formatDate(o.created_at)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-base font-bold text-white font-mono">{formatPKR(o.amount)}</div>
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Offer amount</div>
                                        </div>
                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.bg} ${status.text}`}>
                                            {status.label}
                                        </span>
                                        <i className={`fas fa-chevron-down text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>
                            </button>

                            {/* Expanded detail */}
                            {isExpanded && (
                                detailLoadingId === o._id ? (
                                    <div className="border-t border-dark-700 px-5 py-6 text-center text-gray-500 text-sm">
                                        Loading details…
                                    </div>
                                ) : (
                                    <ExpandedDetail offer={fullOffer} />
                                )
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-gray-500">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-dark-800 text-gray-300 border border-dark-700 hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Prev
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-dark-800 text-gray-300 border border-dark-700 hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCustomOffers;
