// Campaign Pitches Modal — admin drill-down into "which creators applied to
// this campaign." Opens over the CampaignsModeration list when admin clicks
// the pitches_count number on a campaign card.
//
// Reads POST /admin/campaigns/pitches — a new admin endpoint that returns
// pitches for a given campaign_id, hydrated with creator info (username,
// avatar, city, followers, tier). No mutations — read-only view for now.
//
// Added 2026-08-25 alongside the Campaigns admin rollout. Kept self-contained
// (no new dependencies) so it can drop in without touching the rest of the
// admin bundle.

import React, { useEffect, useState, useCallback } from 'react';
import collabs from '../config/collabs';

interface Creator {
    _id: string;
    username?: string;
    name?: string;
    profile_image?: string | null;
    city?: string | null;
    country?: string | null;
    follower_count?: number | null;
    creator_tier?: string | null;
    is_verified?: boolean;
}

interface Pitch {
    _id: string;
    creator: Creator | null;
    proposed_amount: number;
    proposal: string;
    status: string;
    applied_at: string;
}

interface Props {
    campaignId: string;
    campaignTitle: string;
    onClose: () => void;
}

const STATUS_PILL_STYLES: Record<string, { color: string; bg: string; label: string }> = {
    applied:            { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'Under review' },
    selected:           { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   label: 'Hired' },
    hired:              { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   label: 'Hired' },
    rejected:           { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'Not selected' },
    withdrawn:          { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', label: 'Withdrawn' },
    campaign_closed:    { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', label: 'Campaign closed' },
    campaign_cancelled: { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', label: 'Campaign cancelled' },
};

const TIER_LABELS: Record<string, string> = {
    nano:      'Nano · 1K–10K',
    micro:     'Micro · 10K–50K',
    macro:     'Macro · 50K–100K',
    mega:      'Mega · 100K–500K',
    elite:     'Elite · 500K–1M',
    celebrity: 'Celebrity · 1M+',
};

function formatPKR(v: number | undefined | null): string {
    if (v === null || v === undefined) return '—';
    return 'PKR ' + Number(v).toLocaleString();
}

function formatFollowers(n?: number | null): string {
    if (n == null) return '—';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

function formatWhen(d?: string): string {
    if (!d) return '—';
    const then = new Date(d).getTime();
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 60 / 24)}d ago`;
}

const CampaignPitchesModal: React.FC<Props> = ({ campaignId, campaignTitle, onClose }) => {
    const [pitches, setPitches] = useState<Pitch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPitches = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await collabs.post('/admin/campaigns/pitches', { campaign_id: campaignId });
            if (res.data?.success) {
                setPitches(res.data.data?.pitches || []);
            } else {
                setError(res.data?.message || 'Could not load pitches.');
            }
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    }, [campaignId]);

    useEffect(() => { fetchPitches(); }, [fetchPitches]);

    // Escape to close — matches DeleteConfirmationModal + BrandActivityDetail behaviour
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="bg-dark-800 border border-dark-700 rounded-lg w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between p-5 border-b border-dark-700">
                    <div>
                        <h3 className="text-lg font-bold text-white">Applicants</h3>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{campaignTitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-1"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 overflow-y-auto flex-1">
                    {loading && (
                        <div className="text-center text-gray-400 py-8">Loading pitches…</div>
                    )}
                    {error && (
                        <div className="bg-red-900/40 border border-red-700 text-red-200 p-3 rounded text-sm">
                            {error}
                        </div>
                    )}
                    {!loading && !error && pitches.length === 0 && (
                        <div className="text-center text-gray-400 py-8">
                            No pitches yet.
                        </div>
                    )}
                    <div className="space-y-3">
                        {pitches.map(p => {
                            const c = p.creator;
                            const pill = STATUS_PILL_STYLES[p.status] || { color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', label: p.status };
                            const tierLabel = c?.creator_tier ? TIER_LABELS[c.creator_tier] : null;
                            return (
                                <div key={p._id} className="bg-dark-900 border border-dark-700 rounded p-4">
                                    <div className="flex items-start gap-3">
                                        {c?.profile_image ? (
                                            <img src={c.profile_image} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-dark-700 flex items-center justify-center text-gray-500 text-sm flex-shrink-0">
                                                {(c?.name || c?.username || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-white truncate">
                                                    {c?.name || c?.username || 'Unknown creator'}
                                                </span>
                                                {c?.username && c?.name && (
                                                    <span className="text-xs text-gray-500">@{c.username}</span>
                                                )}
                                                {c?.is_verified && (
                                                    <span className="text-xs text-blue-400" title="Verified">✓</span>
                                                )}
                                                <span
                                                    className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                                                    style={{ color: pill.color, background: pill.bg }}
                                                >
                                                    {pill.label}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                                                {c?.city && <span>{c.city}{c.country ? `, ${c.country}` : ''}</span>}
                                                {c?.follower_count != null && <span>{formatFollowers(c.follower_count)} followers</span>}
                                                {tierLabel && <span>{tierLabel}</span>}
                                                <span className="ml-auto">Applied {formatWhen(p.applied_at)}</span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-3">
                                                <span className="text-sm font-semibold text-white">
                                                    {formatPKR(p.proposed_amount)}
                                                </span>
                                                {c?._id && (
                                                    <a
                                                        href={`/influencers/${c._id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline ml-auto"
                                                    >
                                                        View profile →
                                                    </a>
                                                )}
                                            </div>
                                            {p.proposal && (
                                                <div className="mt-2 text-sm text-gray-300 whitespace-pre-wrap bg-dark-800 border border-dark-700 rounded p-3">
                                                    {p.proposal}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-dark-700 flex justify-between items-center text-xs text-gray-400">
                    <span>{loading ? '' : `${pitches.length} pitch${pitches.length === 1 ? '' : 'es'}`}</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CampaignPitchesModal;
