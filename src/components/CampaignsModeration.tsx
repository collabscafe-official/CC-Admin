// Campaigns moderation queue — approves or rejects brand-posted campaigns
// before they go live to creators. See CC-Docs/CAMPAIGNS_PLAN.md.
//
// One tab, three actions:
//   - list-pending : GET the pending_review queue (paginated)
//   - approve      : flips status→open, sets deadline
//   - reject       : freeform reason, flips status→rejected

import React, { useEffect, useState, useCallback } from 'react';
import collabs from '../config/collabs';

interface Campaign {
    _id: string;
    title: string;
    brief: string;
    status: string;
    rejection_reason?: string;
    pitches_count?: number;
    submitted_at?: string;
    approved_at?: string;
    closed_at?: string;
    application_deadline?: string;
    application_deadline_days?: number;
    budget: { min: number; max: number; currency?: string };
    deliverable: { platform: string; type: string; quantity: number };
    category?: { _id: string; name?: string | null };
    brand?: {
        _id: string;
        brand_name?: string;
        brand_logo?: string | null;
        website?: string | null;
        email?: string | null;
        social_handles?: Array<{ platform: string; url: string }>;
    };
}

// Status tabs — per user directive 2026-08-11 admin sees ALL campaigns, not
// just pending_review. Order matches typical review flow (pending first).
const STATUS_TABS: Array<{ key: string; label: string; count?: boolean }> = [
    { key: 'pending_review', label: 'Under review' },
    { key: 'open',           label: 'Active' },
    { key: 'in_progress',    label: 'In progress' },
    { key: 'closed',         label: 'Closed' },
    { key: 'rejected',       label: 'Denied' },
    { key: 'cancelled',      label: 'Cancelled' },
    { key: 'completed',      label: 'Completed' },
    { key: 'all',            label: 'All' },
];

const STATUS_PILL_STYLES: Record<string, { color: string; bg: string }> = {
    pending_review: { color: '#d97706', bg: 'rgba(217,119,6,0.15)' },
    open:           { color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
    in_progress:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
    closed:         { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
    rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    cancelled:      { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
    completed:      { color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
};

function formatPKR(v: number | undefined) {
    if (v === null || v === undefined) return '—';
    return 'PKR ' + Number(v).toLocaleString();
}

function formatWhen(d?: string) {
    if (!d) return '—';
    const then = new Date(d).getTime();
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 60 / 24)}d ago`;
}

const CampaignsModeration: React.FC = () => {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [tab, setTab] = useState<string>('pending_review');

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Backend list-pending endpoint accepts an optional status filter.
            // Passing status='all' or omitting the field returns everything;
            // we send an explicit '' status when tab==='all' so the backend
            // controller's default (pending_review) doesn't apply.
            const body: any = {};
            if (tab && tab !== 'all') body.status = tab;
            else body.status = ''; // controller will treat empty string as no filter
            const res = await collabs.post('/admin/campaigns/list-pending', body);
            if (res.data?.success) {
                setCampaigns(res.data.data?.campaigns || []);
            } else {
                setError(res.data?.message || 'Could not load campaigns.');
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);

    async function approve(id: string) {
        if (!confirm('Approve this campaign? It will go live to creators immediately.')) return;
        setBusyId(id);
        try {
            const res = await collabs.post('/admin/campaigns/approve', { id });
            if (res.data?.success) {
                // Refetch so the campaign moves out of the current tab into
                // its new status tab (was removed from list before, but that
                // was misleading when viewing the 'All' tab).
                fetchQueue();
            } else {
                alert(res.data?.message || 'Could not approve.');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Something went wrong.');
        } finally {
            setBusyId(null);
        }
    }

    async function reject() {
        if (!rejectModal) return;
        const reason = rejectReason.trim();
        if (!reason) {
            alert('Rejection reason is required (brand sees this).');
            return;
        }
        setBusyId(rejectModal.id);
        try {
            const res = await collabs.post('/admin/campaigns/reject', { id: rejectModal.id, reason });
            if (res.data?.success) {
                setRejectModal(null);
                setRejectReason('');
                fetchQueue();
            } else {
                alert(res.data?.message || 'Could not reject.');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Something went wrong.');
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="text-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Campaigns</h1>
                    <p className="text-sm text-gray-400">
                        {loading ? 'Loading…' : `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} shown`}
                    </p>
                </div>
                <button
                    onClick={fetchQueue}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                    disabled={loading}
                >
                    Refresh
                </button>
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-2 flex-wrap mb-6">
                {STATUS_TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                            tab === t.key
                                ? 'bg-primary text-white'
                                : 'bg-dark-800 text-gray-400 hover:text-white border border-dark-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-200 p-4 rounded mb-4">{error}</div>
            )}

            {!loading && !error && campaigns.length === 0 && (
                <div className="bg-dark-800 border border-dark-700 p-8 rounded text-center text-gray-400">
                    No campaigns in this state.
                </div>
            )}

            <div className="space-y-4">
                {campaigns.map(c => {
                    const isExpanded = expandedId === c._id;
                    const isActionable = c.status === 'pending_review';
                    const pillStyle = STATUS_PILL_STYLES[c.status] || { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' };
                    const statusLabel = STATUS_TABS.find(t => t.key === c.status)?.label || c.status;
                    return (
                        <div key={c._id} className="bg-dark-800 border border-dark-700 rounded-lg p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    {/* Brand block */}
                                    <div className="flex items-center gap-3 mb-3">
                                        {c.brand?.brand_logo && (
                                            <img src={c.brand.brand_logo} alt="" className="w-10 h-10 rounded object-cover" />
                                        )}
                                        <div>
                                            <div className="font-semibold text-white">{c.brand?.brand_name || 'Brand'}</div>
                                            <div className="text-xs text-gray-400 flex gap-2 flex-wrap">
                                                {c.brand?.email && <span>{c.brand.email}</span>}
                                                {c.brand?.website && (
                                                    <a href={c.brand.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                                        {c.brand.website.replace(/^https?:\/\//, '')}
                                                    </a>
                                                )}
                                                {c.brand?.social_handles?.map((s, i) => (
                                                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                                                        {s.platform}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                        <span
                                            className="ml-auto px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                                            style={{ color: pillStyle.color, background: pillStyle.bg }}
                                        >
                                            {statusLabel}
                                        </span>
                                    </div>

                                    {/* Campaign summary */}
                                    <h3 className="text-lg font-bold text-white mb-2">{c.title}</h3>
                                    <div className="flex gap-4 flex-wrap text-sm text-gray-400 mb-3">
                                        <span className="px-2 py-0.5 bg-blue-900/40 text-blue-200 rounded text-xs">
                                            {c.category?.name || 'Category'}
                                        </span>
                                        <span>
                                            {c.deliverable?.platform} · {c.deliverable?.type} × {c.deliverable?.quantity}
                                        </span>
                                        <span>{formatPKR(c.budget?.min)} – {formatPKR(c.budget?.max)}</span>
                                        {typeof c.pitches_count === 'number' && (
                                            <span>{c.pitches_count} pitch{c.pitches_count === 1 ? '' : 'es'}</span>
                                        )}
                                        <span>Submitted {formatWhen(c.submitted_at)}</span>
                                    </div>

                                    {/* Rejection reason surfaced on 'rejected' rows so admins can audit */}
                                    {c.status === 'rejected' && c.rejection_reason && (
                                        <div className="text-xs text-red-300 bg-red-900/20 border border-red-800/50 rounded p-2 mb-3">
                                            <strong>Reason sent to brand:</strong> {c.rejection_reason}
                                        </div>
                                    )}

                                    {/* Brief — collapsed by default; long briefs need a click to expand */}
                                    <div className="text-sm text-gray-300 whitespace-pre-wrap">
                                        {isExpanded
                                            ? c.brief
                                            : (c.brief || '').slice(0, 300) + ((c.brief || '').length > 300 ? '…' : '')}
                                    </div>
                                    {(c.brief || '').length > 300 && (
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : c._id)}
                                            className="mt-2 text-primary text-sm hover:underline"
                                        >
                                            {isExpanded ? 'Show less' : 'Show full brief'}
                                        </button>
                                    )}
                                </div>

                                {isActionable && (
                                    <div className="flex flex-col gap-2 min-w-[130px]">
                                        <button
                                            onClick={() => approve(c._id)}
                                            disabled={busyId === c._id}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium text-sm"
                                        >
                                            {busyId === c._id ? 'Working…' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => { setRejectModal({ id: c._id, title: c.title }); setRejectReason(''); }}
                                            disabled={busyId === c._id}
                                            className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded font-medium text-sm"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Reject modal */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 max-w-lg w-full mx-4">
                        <h3 className="text-lg font-bold text-white mb-2">Reject campaign</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            "{rejectModal.title}" — the brand will see the reason below verbatim in the rejection email.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={5}
                            maxLength={1000}
                            placeholder="e.g. Budget range is too broad. Please tighten to a 1.5x spread. Or: Please add specifics about the deliverable format."
                            className="w-full bg-dark-900 border border-dark-700 rounded p-3 text-sm text-white"
                            autoFocus
                        />
                        <div className="text-xs text-gray-500 mt-1">{rejectReason.length}/1000</div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={reject}
                                disabled={!rejectReason.trim() || busyId === rejectModal.id}
                                className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white rounded text-sm"
                            >
                                {busyId === rejectModal.id ? 'Rejecting…' : 'Send rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CampaignsModeration;
