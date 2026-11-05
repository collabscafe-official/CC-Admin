import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ANALYTICS_CONFIG from '../config/analyticsService';
import { adminServiceHeaders } from '../config/adminServiceHeaders';

// Admin TrustLens AI card. Mirrors what brands see on the public creator
// profile (CC-Public CreatorTrustScoreV5): tier pill, platform tabs, audience
// split, Primary + Additional tiles. No score, signals or flags.
//
// Data: GET /social/stats/:identifier/:platform/diagnostic (analytics-service).
// `stats` feeds the tiles (same math as V5); the audience split comes from
// `diagnostic.audienceCompositionDisplay`, which runs the same per-platform
// formulas V5 runs, so the admin never keeps a third copy of them.

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  ...adminServiceHeaders(API_KEY),
});

type Platform = 'instagram' | 'youtube' | 'tiktok';
const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};
const PLATFORM_ORDER: Platform[] = ['instagram', 'youtube', 'tiktok'];

// Same priors as CC-Public lib/trustLensV2 REACH_PRIORS.
const REACH_PRIORS: Record<Platform, number> = { instagram: 0.15, youtube: 0.30, tiktok: 1.0 };

type DiagnosticResponse = {
  platform: Platform;
  stats: any;
  diagnostic: {
    creatorTierLabel: string;
    audienceCompositionDisplay: { real: number; suspicious: number };
  } | null;
};

interface Props {
  identifier: string; // creator ObjectId or username
}

// Same formatting as V5's fmt().
function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1) + 'K';
  return String(Math.round(n));
}

const Tiles: React.FC<{ title: string; items: { val: string; label: string }[] }> = ({ title, items }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</p>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((m) => (
        <div key={m.label} className="rounded-lg bg-gray-50 dark:bg-dark-700 px-2 py-3 text-center">
          <div className="text-base font-semibold text-gray-900 dark:text-white">{m.val}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.label}</div>
        </div>
      ))}
    </div>
  </div>
);

const TrustLensAdminPanel: React.FC<Props> = ({ identifier }) => {
  const [platforms, setPlatforms] = useState<Platform[] | null>(null);
  const [active, setActive] = useState<Platform | null>(null);
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Which platforms have synced stats → tabs.
  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/social/stats/${identifier}`, { headers: apiHeaders() })
      .then((r) => (r.ok ? r.json() : { platforms: [] }))
      .then((body) => {
        if (!alive) return;
        const found = PLATFORM_ORDER.filter((p) => (body?.platforms || []).some((s: any) => s?.platform === p));
        setPlatforms(found);
        setActive(found[0] || null);
      })
      .catch(() => { if (alive) setPlatforms([]); });
    return () => { alive = false; };
  }, [identifier]);

  const load = useCallback(async () => {
    if (!identifier || !active) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/social/stats/${identifier}/${active}/diagnostic`, { headers: apiHeaders() });
      if (!res.ok) {
        setData(null);
        setError(res.status === 404 ? `No ${PLATFORM_LABELS[active]} stats synced yet.` : `Couldn't load TrustLens (HTTP ${res.status}).`);
        return;
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [identifier, active]);

  useEffect(() => { load(); }, [load]);

  const stats = data?.platform === active ? data?.stats : null;
  const diag = data?.platform === active ? data?.diagnostic : null;

  // Tiles: same fields and math as CreatorTrustScoreV5.
  const { primary, additional } = useMemo(() => {
    if (!stats || !active) return { primary: [], additional: [] };
    const followers = stats.followers || 0;
    const avgViews = stats.avgViews || 0;
    const postFreq = stats.postFrequencyPerWeek || 0;
    const prior = REACH_PRIORS[active] || 0.15;
    const vpf = followers > 0 ? avgViews / followers : 0;
    const reach = followers > 0 ? (vpf * followers + prior * 5000) / (followers + 5000) : prior;

    let fourth: { val: string; label: string };
    if (active === 'youtube') {
      const at = stats.raw?.publishedAt;
      fourth = {
        val: at ? `${((Date.now() - new Date(at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1)} yrs` : '—',
        label: 'Channel age',
      };
    } else {
      fourth = { val: fmt(stats.postsCount || 0), label: active === 'instagram' ? 'Total posts' : 'Total videos' };
    }

    return {
      primary: [
        { val: `${(stats.engagementRate || 0).toFixed(1)}%`, label: 'Eng. rate' },
        { val: fmt(followers), label: active === 'youtube' ? 'Subscribers' : 'Followers' },
        { val: fmt(active === 'instagram' ? stats.avgLikes || 0 : avgViews), label: active === 'instagram' ? 'Avg likes' : 'Avg views' },
        { val: fmt(stats.avgComments || 0), label: 'Avg comments' },
      ],
      additional: [
        { val: postFreq > 0 ? `${postFreq.toFixed(1)}/wk` : '—', label: 'Post freq.' },
        { val: `${((stats.commentToLikeRatio || 0) * 100).toFixed(1)}%`, label: 'C/L ratio' },
        { val: `${(reach * 100).toFixed(0)}%`, label: 'Reach' },
        fourth,
      ],
    };
  }, [stats, active]);

  const comp = diag?.audienceCompositionDisplay;

  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200 dark:bg-dark-800 dark:border-dark-700">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">TrustLens AI</h3>
        {diag?.creatorTierLabel && (
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
            {diag.creatorTierLabel} creator
          </span>
        )}
      </div>

      {platforms === null && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
      {platforms?.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No synced social accounts yet, so there's nothing to show.</p>
      )}

      {platforms && platforms.length > 0 && (
        <>
          {platforms.length > 1 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setActive(p)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                    active === p
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-dark-700 dark:text-gray-400 dark:border-dark-600'
                  }`}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          )}

          {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
          {error && !loading && <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>}

          {!loading && !error && stats && (
            <div className="space-y-4">
              {comp && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Audience composition (est.)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-50 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20">
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{comp.real}%</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Real audience</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-amber-50 border border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20">
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{comp.suspicious}%</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Suspicious</span>
                    </div>
                  </div>
                </div>
              )}
              <Tiles title="Primary" items={primary} />
              <Tiles title="Additional" items={additional} />
              <div className="flex items-center justify-between gap-2 flex-wrap pt-3 border-t border-gray-100 dark:border-dark-700 text-xs text-gray-500 dark:text-gray-400">
                <span>Verified via {PLATFORM_LABELS[active as Platform]} API</span>
                {stats.lastSyncedAt && <span>Last synced {new Date(stats.lastSyncedAt).toLocaleDateString()}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrustLensAdminPanel;
