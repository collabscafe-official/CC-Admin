import React, { useCallback, useEffect, useState } from 'react';
import ANALYTICS_CONFIG from '../config/analyticsService';

// Admin-only inline TrustLens AI panel. Shows the same v2 outputs that V5
// renders on the public creator profile, PLUS the per-signal calculation
// breakdown and per-suspicion-flag triggered/not-triggered status. Lets
// admins answer "why is this creator's score X?" without leaving the
// influencer review page.
//
// Backed by GET /social/stats/:identifier/:platform/diagnostic (analytics-service).

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  'x-api-key': API_KEY,
});

type Platform = 'instagram' | 'youtube' | 'tiktok';
const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

type Diagnostic = {
  platform: string;
  creatorTier: string;
  creatorTierLabel: string;
  benchmark: number;
  finalScore: number;
  scoreTierLabel: string;
  confidence: string;
  signalBreakdown: Array<{
    key: string;
    label: string;
    weight: number;
    score: number;
    input: string;
    note: string;
  }>;
  trustScoreFlags: Array<{
    name: string;
    label: string;
    triggered: boolean;
    threshold: string;
    actual: string;
  }>;
  compositionFlags: Array<{
    name: string;
    label: string;
    triggered: boolean;
    threshold: string;
    actual: string;
  }>;
  audienceCompositionDisplay: { real: number; suspicious: number };
  formulaVersion: string;
};

type DiagnosticResponse = {
  creator: { _id: string; username: string; name: string };
  platform: Platform;
  stats: any;
  diagnostic: Diagnostic | null;
};

interface Props {
  identifier: string; // creator ObjectId or username
  availablePlatforms?: Platform[]; // optional — if known from parent, skip auto-detect
}

const tierColor = (label: string) => {
  if (label === 'Highly Authentic') return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30';
  if (label === 'Mostly Authentic') return 'text-green-400 bg-green-500/10 border border-green-500/30';
  if (label === 'Average')          return 'text-amber-400 bg-amber-500/10 border border-amber-500/30';
  if (label === 'High Risk')        return 'text-red-400 bg-red-500/10 border border-red-500/30';
  return 'text-gray-400 bg-gray-500/10 border border-gray-500/30';
};

const TrustLensAdminPanel: React.FC<Props> = ({ identifier, availablePlatforms }) => {
  const [activePlatform, setActivePlatform] = useState<Platform>('instagram');
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [foundPlatforms, setFoundPlatforms] = useState<Platform[]>([]);

  // Auto-detect which platforms have synced data so we only show tabs for those.
  // Skipped if parent provided availablePlatforms.
  const detectPlatforms = useCallback(async () => {
    if (availablePlatforms && availablePlatforms.length > 0) {
      setFoundPlatforms(availablePlatforms);
      setActivePlatform(availablePlatforms[0]);
      return;
    }
    try {
      const res = await fetch(`${BASE}/social/stats/${identifier}`, { headers: apiHeaders() });
      if (!res.ok) return;
      const body = await res.json();
      const platforms = (body?.platforms || [])
        .map((p: any) => p?.platform as Platform)
        .filter((p: Platform) => p === 'instagram' || p === 'youtube' || p === 'tiktok');
      if (platforms.length > 0) {
        setFoundPlatforms(platforms);
        setActivePlatform(platforms[0]);
      }
    } catch {
      // Silent — parent error UI will show the empty state
    }
  }, [identifier, availablePlatforms]);

  useEffect(() => { detectPlatforms(); }, [detectPlatforms]);

  const fetchDiagnostic = useCallback(async () => {
    if (!identifier || !activePlatform) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${BASE}/social/stats/${identifier}/${activePlatform}/diagnostic`,
        { headers: apiHeaders() }
      );
      if (!res.ok) {
        if (res.status === 404) {
          setData(null);
          setError(`No ${PLATFORM_LABELS[activePlatform]} stats synced for this creator.`);
        } else {
          setError(`Failed to load diagnostic (HTTP ${res.status})`);
        }
        return;
      }
      const body: DiagnosticResponse = await res.json();
      setData(body);
    } catch (err: any) {
      setError(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [identifier, activePlatform]);

  useEffect(() => { fetchDiagnostic(); }, [fetchDiagnostic]);

  if (foundPlatforms.length === 0 && !loading) {
    return (
      <div className="p-6 bg-white dark:bg-dark-800 rounded-lg shadow-md">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">TrustLens AI</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">No synced social platforms — TrustLens cannot be computed.</p>
      </div>
    );
  }

  const diag = data?.diagnostic;

  return (
    <div className="p-8 bg-white dark:bg-dark-800 rounded-lg shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">TrustLens AI — Audience Analysis</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Per-signal breakdown + suspicion-flag diagnostic. Same numbers that render on the public V5 card.
          </p>
        </div>
        {diag && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30">
            Formula {diag.formulaVersion}
          </span>
        )}
      </div>

      {/* Platform tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {foundPlatforms.map((p) => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              activePlatform === p
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-dark-700 dark:text-gray-400 dark:border-dark-600 hover:border-emerald-500/30'
            }`}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading diagnostic…</p>
      )}

      {error && !loading && (
        <p className="text-sm text-amber-500">{error}</p>
      )}

      {!loading && !error && diag && (
        <>
          {/* Headline row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1">Trust Score</div>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-extrabold bg-gradient-to-r from-emerald-500 to-purple-500 bg-clip-text text-transparent">
                  {diag.finalScore}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${tierColor(diag.scoreTierLabel)}`}>
                  {diag.scoreTierLabel || '—'}
                </span>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1">Creator Tier</div>
              <div className="text-lg font-bold text-purple-400">{diag.creatorTierLabel}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Benchmark: {diag.benchmark}% ER</div>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1">Real Audience</div>
              <div className="text-2xl font-extrabold text-emerald-400">{diag.audienceCompositionDisplay.real}%</div>
            </div>
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-1">Suspicious</div>
              <div className="text-2xl font-extrabold text-amber-400">{diag.audienceCompositionDisplay.suspicious}%</div>
            </div>
          </div>

          {/* Signal breakdown */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Signal Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-dark-700">
                    <th className="text-left py-2 pr-3 font-semibold">Signal</th>
                    <th className="text-right py-2 px-3 font-semibold">Weight</th>
                    <th className="text-right py-2 px-3 font-semibold">Score</th>
                    <th className="text-left py-2 px-3 font-semibold">Input</th>
                    <th className="text-left py-2 pl-3 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {diag.signalBreakdown.map((s) => (
                    <tr key={s.key} className="border-b border-gray-100 dark:border-dark-700/50">
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 font-medium">{s.label}</td>
                      <td className="py-2 px-3 text-right text-gray-500 dark:text-gray-400">{s.weight}%</td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">{s.score}</td>
                      <td className="py-2 px-3 font-mono text-xs text-gray-500 dark:text-gray-400">{s.input}</td>
                      <td className="py-2 pl-3 text-xs text-gray-500 dark:text-gray-400">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trust score flags */}
          {diag.trustScoreFlags && diag.trustScoreFlags.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                Trust Score — Suspicion Flags (composite penalty)
              </h4>
              <div className="space-y-2">
                {diag.trustScoreFlags.map((f) => (
                  <div
                    key={f.name}
                    className={`p-3 rounded-lg border flex items-start gap-3 ${
                      f.triggered
                        ? 'bg-red-500/5 border-red-500/30'
                        : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        f.triggered ? 'bg-red-500 text-white' : 'bg-gray-300 dark:bg-dark-600 text-gray-500'
                      }`}
                    >
                      {f.triggered ? '✓' : '○'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">{f.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="font-mono">{f.threshold}</span>
                        <span className="mx-2">·</span>
                        <span className="font-mono">{f.actual}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Composition flags */}
          {diag.compositionFlags && diag.compositionFlags.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                Audience Composition — Platform-specific Flags
              </h4>
              <div className="space-y-2">
                {diag.compositionFlags.map((f) => (
                  <div
                    key={f.name}
                    className={`p-3 rounded-lg border flex items-start gap-3 ${
                      f.triggered
                        ? 'bg-amber-500/5 border-amber-500/30'
                        : 'bg-gray-50 dark:bg-dark-700 border-gray-200 dark:border-dark-600'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        f.triggered ? 'bg-amber-500 text-white' : 'bg-gray-300 dark:bg-dark-600 text-gray-500'
                      }`}
                    >
                      {f.triggered ? '✓' : '○'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">{f.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="font-mono">{f.threshold}</span>
                        <span className="mx-2">·</span>
                        <span className="font-mono">{f.actual}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-dark-700 pt-4 mt-4 flex-wrap gap-2">
            <span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">Confidence:</span>{' '}
              <span className="uppercase tracking-wider">{diag.confidence}</span>
            </span>
            {data?.stats?.lastSyncedAt && (
              <span>
                Last synced: {new Date(data.stats.lastSyncedAt).toLocaleString()}
              </span>
            )}
            {data?.stats?.lastSyncStatus && (
              <span>
                Sync status: <span className={data.stats.lastSyncStatus === 'ok' ? 'text-emerald-400' : 'text-amber-400'}>{data.stats.lastSyncStatus}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TrustLensAdminPanel;
