import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ANALYTICS_CONFIG from '../config/analyticsService';

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
});

type Status = 'all' | 'ok' | 'not_found' | 'failed' | 'pending';
type Platform = 'youtube' | 'tiktok' | 'instagram';

// For YouTube, a SocialStats row = "URL was added and we successfully fetched
// stats." For TikTok, a row only exists after the creator completed OAuth (the
// callback writes it). For Instagram, a row exists either via OAuth callback
// (/connected-accounts) OR after a refresh that ran BD against the handle.
// So filtering by platform=instagram answers "which creators have IG stats."
const PLATFORM_META: Record<Platform, { label: string; dot: string; verb: string }> = {
  youtube:   { label: 'YouTube',   dot: 'bg-red-500',     verb: 'Re-fetch from YouTube'   },
  tiktok:    { label: 'TikTok',    dot: 'bg-pink-500',    verb: 'Re-fetch from TikTok'    },
  instagram: { label: 'Instagram', dot: 'bg-fuchsia-500', verb: 'Re-fetch from Instagram' },
};

interface Item {
  _id: string;
  creator: { _id: string; username: string; name: string; profile_image?: string } | null;
  platform: string;
  handle: string;
  handleUrl: string;
  handleActive: boolean;
  profileUrl: string;
  displayName: string;
  followers: number;
  audienceQualityScore: number;
  audienceQualityGrade: string;
  lastSyncedAt: string;
  lastSyncStatus: string;
  lastSyncError: string;
  // True when the creator OAuth-connected this platform (TikTok or Instagram
  // via /connected-accounts). Always false for YouTube — no OAuth flow there.
  oauthConnected: boolean;
}

// OAuth attempt row — what the OAuthAttempt audit collection returns hydrated.
// One per callback hit (success or failure).
interface OAuthAttemptItem {
  _id: string;
  creator: { _id: string; username: string; name: string; profile_image?: string } | null;
  platform: 'instagram' | 'tiktok';
  outcome:
    | 'success'
    | 'stats_fetch_failed'
    | 'access_denied'
    | 'no_pages'
    | 'no_ig_linked'
    | 'token_exchange_failed'
    | 'invalid_state'
    | 'missing_params'
    | 'unknown';
  errorMessage: string;
  metaCode: number | null;
  attemptedAt: string;
}

interface OAuthAttemptsResponse {
  items: OAuthAttemptItem[];
  total: number;
  page: number;
  limit: number;
  summary: Record<string, number>;
}

// Friendly labels + badge colors per outcome
const OUTCOME_META: Record<OAuthAttemptItem['outcome'], { label: string; bg: string; text: string }> = {
  success:                { label: 'Success',              bg: 'bg-green-500/15',   text: 'text-green-400' },
  stats_fetch_failed:     { label: 'Stats Fetch Failed',   bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  access_denied:          { label: 'Permissions Denied',   bg: 'bg-red-500/15',     text: 'text-red-400'   },
  no_pages:               { label: 'No FB Pages',          bg: 'bg-orange-500/15',  text: 'text-orange-400'},
  no_ig_linked:           { label: 'No IG Business Linked',bg: 'bg-orange-500/15',  text: 'text-orange-400'},
  token_exchange_failed:  { label: 'Token Exchange Failed',bg: 'bg-red-500/15',     text: 'text-red-400'   },
  invalid_state:          { label: 'Invalid State (CSRF)', bg: 'bg-gray-500/15',    text: 'text-gray-400'  },
  missing_params:         { label: 'Missing Params',       bg: 'bg-gray-500/15',    text: 'text-gray-400'  },
  unknown:                { label: 'Unknown',              bg: 'bg-gray-500/15',    text: 'text-gray-400'  },
};

type View = 'sync' | 'attempts' | 'auto-resync';

// ── TrustLens auto-resync types ──────────────────────────────────────────────

interface PlatformCounter {
  eligible: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  last_processed_index: number;
}

interface SyncRun {
  _id: string;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
  triggered_by: 'cron' | 'admin_manual';
  triggered_by_user?: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  scope_creators_eligible: number;
  instagram?: PlatformCounter;
  youtube?: PlatformCounter;
  tiktok?: PlatformCounter;
  errors?: Array<{ creator_id: string; username: string; platform: string; message: string; at: string }>;
  notes?: string;
  createdAt: string;
}

interface IGRateLimitState {
  daily_cap: number;
  calls_in_window: number;
  window_started_at: string | null;
  last_call_ended_at: string | null;
  in_backoff: boolean;
  backoff_until: string | null;
  backoff_level: number;
  min_interval_ms: number;
}

interface RecentSyncRow {
  _id: string;
  creator: string;
  platform: string;
  lastSyncedAt: string;
  lastSyncStatus: string;
  lastSyncSource?: string;
  creator_profile: { _id: string; username: string; name: string; profile_picture?: string } | null;
}

interface AutoSyncStatusResponse {
  latest_run: SyncRun | null;
  is_running: boolean;
  running_run: SyncRun | null;
  next_scheduled_at: string;
  ig_rate_limit: IGRateLimitState;
  recent_syncs: RecentSyncRow[];
}

interface ApiResponse {
  items: Item[];
  total: number;
  page: number;
  limit: number;
  summary: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtNumber(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtTimeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    ok:        { bg: 'bg-green-500/15',  text: 'text-green-400',  label: 'OK' },
    not_found: { bg: 'bg-red-500/15',    text: 'text-red-400',    label: 'Not Found' },
    failed:    { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'Failed' },
    pending:   { bg: 'bg-gray-500/15',   text: 'text-gray-400',   label: 'Pending' },
  };
  const m = map[status] || { bg: 'bg-gray-500/15', text: 'text-gray-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function gradeBadge(grade: string, score: number) {
  if (!grade || !score) return <span className="text-gray-500 text-xs">—</span>;
  const map: Record<string, string> = {
    A: 'bg-green-500/20 text-green-300 border-green-500/30',
    B: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    C: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    D: 'bg-red-500/20 text-red-300 border-red-500/30',
    F: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  const cls = map[grade.charAt(0)] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${cls}`}>
      {score} <span className="opacity-70">·</span> {grade}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────

const SocialSyncStatus: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [platform, setPlatform] = useState<Platform>('youtube');
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [sort, setSort] = useState<'lastSyncedAt' | 'score' | 'followers'>('lastSyncedAt');
  const [refreshing, setRefreshing] = useState<string>(''); // _id currently refreshing

  // View toggle — 'sync' (existing table) vs 'attempts' (OAuth audit log)
  const [view, setView] = useState<View>('sync');
  const [attemptsData, setAttemptsData] = useState<OAuthAttemptsResponse | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsOutcome, setAttemptsOutcome] = useState<string>('all');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        platform,
        status,
        search: debouncedSearch,
        page: String(page),
        limit: String(limit),
        sort,
      });
      const res = await fetch(`${BASE}/social/admin/list?${params}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as ApiResponse;
      setData(body);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [platform, status, debouncedSearch, page, limit, sort]);

  useEffect(() => {
    if (view === 'sync') fetchList();
  }, [fetchList, view]);

  // OAuth Attempts fetch — runs when view='attempts' and platform/outcome/page changes.
  // YouTube isn't in the audit (no OAuth flow), so we silently swap to instagram.
  const fetchAttempts = useCallback(async () => {
    setAttemptsLoading(true);
    setError('');
    try {
      const effectivePlatform = platform === 'youtube' ? 'instagram' : platform;
      const params = new URLSearchParams({
        platform: effectivePlatform,
        outcome: attemptsOutcome,
        page: String(page),
        limit: String(limit),
      });
      const res = await fetch(`${BASE}/social/admin/oauth-attempts?${params}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as OAuthAttemptsResponse;
      setAttemptsData(body);
    } catch (e: any) {
      setError(e.message || 'Failed to load OAuth attempts');
    } finally {
      setAttemptsLoading(false);
    }
  }, [platform, attemptsOutcome, page, limit]);

  useEffect(() => {
    if (view === 'attempts') fetchAttempts();
  }, [fetchAttempts, view]);

  const handleRefreshOne = async (item: Item) => {
    if (!item.creator) return;
    setRefreshing(item._id);
    try {
      const res = await fetch(
        `${BASE}/social/refresh/${item.creator._id}/${item.platform}`,
        {
          method: 'POST',
          headers: apiHeaders(),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Re-fetch list to get updated row
      await fetchList();
    } catch (e: any) {
      setError(`Refresh failed for @${item.creator?.username}: ${e.message}`);
    } finally {
      setRefreshing('');
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const summary = data?.summary || {};

  return (
    <div className="text-gray-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Social Sync Status</h1>
        <p className="text-sm text-gray-400">
          Per-creator social platform sync state. Use this page to spot broken URLs and re-sync individual creators.
        </p>
      </div>

      {/* View toggle — switches between sync-status table and OAuth attempts audit */}
      <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => { setView('sync'); setPage(1); }}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            view === 'sync' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          Sync Status
        </button>
        <button
          onClick={() => { setView('attempts'); setPage(1); }}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            view === 'attempts' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          OAuth Attempts
        </button>
        <button
          onClick={() => { setView('auto-resync'); setPage(1); }}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            view === 'auto-resync' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-dark-700'
          }`}
        >
          Auto-Resync
        </button>
      </div>

      {/* ═══ SYNC STATUS VIEW (existing) ═══ */}
      {view === 'sync' && (
      <>
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <SummaryTile label="Total" value={summary.total ?? 0} color="bg-dark-800 border-dark-700" />
        <SummaryTile label="OK" value={summary.ok ?? 0} color="bg-green-500/10 border-green-500/30 text-green-300" />
        <SummaryTile label="Not Found" value={summary.not_found ?? 0} color="bg-red-500/10 border-red-500/30 text-red-300" />
        <SummaryTile label="Failed" value={summary.failed ?? 0} color="bg-orange-500/10 border-orange-500/30 text-orange-300" />
        <SummaryTile label="Pending" value={summary.pending ?? 0} color="bg-gray-500/10 border-gray-500/30 text-gray-300" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Platform toggle */}
        <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1">
          {(Object.keys(PLATFORM_META) as Platform[]).map((p) => (
            <button
              key={p}
              onClick={() => { setPlatform(p); setPage(1); }}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                platform === p
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${PLATFORM_META[p].dot}`} />
              {PLATFORM_META[p].label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1">
          {(['all', 'ok', 'not_found', 'failed', 'pending'] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                status === s
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              {s === 'all' ? 'All' : s === 'not_found' ? 'Not Found' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or name…"
            className="w-full px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as any); setPage(1); }}
          className="px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-primary"
        >
          <option value="lastSyncedAt">Recently synced</option>
          <option value="score">Highest score</option>
          <option value="followers">Most followers</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-dark-900 border-b border-dark-700">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-center">OAuth</th>
                <th className="px-4 py-3 font-medium text-right">Followers</th>
                <th className="px-4 py-3 font-medium text-center">Score</th>
                <th className="px-4 py-3 font-medium">Last Synced</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No matching records</td></tr>
              )}
              {data?.items.map((item) => (
                <tr key={item._id} className="border-b border-dark-700 hover:bg-dark-700/40 transition-colors">
                  <td className="px-4 py-3">
                    {item.creator ? (
                      <button
                        onClick={() => navigate(`/influencers/${item.creator!._id}`)}
                        className="text-left hover:text-primary transition-colors"
                      >
                        <div className="font-medium text-gray-100">@{item.creator.username}</div>
                        <div className="text-xs text-gray-500">{item.creator.name}</div>
                      </button>
                    ) : (
                      <span className="text-gray-500">(creator deleted)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {item.handleUrl ? (
                      <a
                        href={item.handleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline break-all"
                        title={item.handleUrl}
                      >
                        {item.handleUrl.length > 50 ? item.handleUrl.slice(0, 50) + '…' : item.handleUrl}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                    {item.lastSyncStatus !== 'ok' && item.lastSyncError && (
                      <div className="text-xs text-red-400/80 mt-1 italic">{item.lastSyncError}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">{statusBadge(item.lastSyncStatus)}</td>
                  <td className="px-4 py-3 text-center">
                    {item.oauthConnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-500/15 text-green-400">
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-500/15 text-gray-400">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{fmtNumber(item.followers)}</td>
                  <td className="px-4 py-3 text-center">{gradeBadge(item.audienceQualityGrade, item.audienceQualityScore)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtTimeAgo(item.lastSyncedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => handleRefreshOne(item)}
                        disabled={refreshing === item._id || !item.creator}
                        className="px-2 py-1 text-xs rounded bg-dark-700 hover:bg-primary hover:text-white text-gray-300 transition-colors disabled:opacity-50"
                        title={PLATFORM_META[platform].verb}
                      >
                        {refreshing === item._id ? '…' : '↻ Refresh'}
                      </button>
                      {item.creator && (
                        <button
                          onClick={() => navigate(`/influencers/${item.creator!._id}`)}
                          className="px-2 py-1 text-xs rounded bg-dark-700 hover:bg-dark-600 text-gray-300 transition-colors"
                          title="Edit creator (update social URL)"
                        >
                          ✎ Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700 text-xs text-gray-400">
            <div>
              Showing <span className="text-gray-200">{(data.page - 1) * data.limit + 1}</span>
              –
              <span className="text-gray-200">{Math.min(data.page * data.limit, data.total)}</span>
              {' '}of <span className="text-gray-200">{data.total}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="px-3 py-1">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* ═══ AUTO-RESYNC VIEW (TrustLens scheduler) ═══ */}
      {view === 'auto-resync' && (
        <TrustLensAutoSyncView BASE={BASE} apiHeaders={apiHeaders} navigate={navigate} />
      )}

      {/* ═══ OAUTH ATTEMPTS VIEW (new) ═══ */}
      {view === 'attempts' && (
        <OAuthAttemptsView
          BASE={BASE}
          apiHeaders={apiHeaders}
          platform={platform === 'youtube' ? 'instagram' : platform}
          setPlatform={setPlatform}
          attemptsOutcome={attemptsOutcome}
          setAttemptsOutcome={setAttemptsOutcome}
          data={attemptsData}
          loading={attemptsLoading}
          error={error}
          page={page}
          setPage={setPage}
          limit={limit}
          navigate={navigate}
        />
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────

const SummaryTile: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className={`px-4 py-3 rounded-lg border ${color}`}>
    <div className="text-xs uppercase tracking-wide opacity-70 font-semibold">{label}</div>
    <div className="text-2xl font-bold mt-1">{value.toLocaleString()}</div>
  </div>
);

// OAuth Attempts table — separate component for clarity. Renders the audit
// log of every OAuth callback for Instagram + TikTok with outcome filter.
interface OAuthAttemptsViewProps {
  BASE: string;
  apiHeaders: () => Record<string, string>;
  platform: 'instagram' | 'tiktok';
  setPlatform: (p: Platform) => void;
  attemptsOutcome: string;
  setAttemptsOutcome: (o: string) => void;
  data: OAuthAttemptsResponse | null;
  loading: boolean;
  error: string;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  limit: number;
  navigate: (path: string) => void;
}

const OAuthAttemptsView: React.FC<OAuthAttemptsViewProps> = ({
  platform, setPlatform, attemptsOutcome, setAttemptsOutcome,
  data, loading, error, page, setPage, limit, navigate,
}) => {
  const summary = data?.summary || {};
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  // Outcome filter options — derived from OUTCOME_META keys plus "all"
  const outcomeOptions: Array<{ value: string; label: string }> = [
    { value: 'all',                    label: 'All' },
    { value: 'success',                label: 'Success' },
    { value: 'stats_fetch_failed',     label: 'Stats Fetch Failed' },
    { value: 'access_denied',          label: 'Permissions Denied' },
    { value: 'no_pages',               label: 'No FB Pages' },
    { value: 'no_ig_linked',           label: 'No IG Linked' },
    { value: 'token_exchange_failed',  label: 'Token Exchange' },
    { value: 'invalid_state',          label: 'Invalid State' },
    { value: 'missing_params',         label: 'Missing Params' },
    { value: 'unknown',                label: 'Unknown' },
  ];

  return (
    <>
      {/* Summary tiles — total + a couple of key outcomes */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <SummaryTile label="Total Attempts" value={summary.total ?? 0} color="bg-dark-800 border-dark-700" />
        <SummaryTile label="Success"        value={summary.success ?? 0} color="bg-green-500/10 border-green-500/30 text-green-300" />
        <SummaryTile label="No FB Pages"    value={summary.no_pages ?? 0} color="bg-orange-500/10 border-orange-500/30 text-orange-300" />
        <SummaryTile label="Denied"         value={summary.access_denied ?? 0} color="bg-red-500/10 border-red-500/30 text-red-300" />
        <SummaryTile label="Other Failures" value={
          (summary.no_ig_linked ?? 0) +
          (summary.token_exchange_failed ?? 0) +
          (summary.stats_fetch_failed ?? 0) +
          (summary.unknown ?? 0)
        } color="bg-amber-500/10 border-amber-500/30 text-amber-300" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        {/* Platform toggle (IG + TT only — YouTube has no OAuth) */}
        <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1">
          {(['instagram', 'tiktok'] as const).map((p) => (
            <button
              key={p}
              onClick={() => { setPlatform(p); setPage(1); }}
              className={`inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                platform === p
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${PLATFORM_META[p].dot}`} />
              {PLATFORM_META[p].label}
            </button>
          ))}
        </div>

        {/* Outcome filter */}
        <select
          value={attemptsOutcome}
          onChange={(e) => { setAttemptsOutcome(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-primary"
        >
          {outcomeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Attempts table */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-dark-900 border-b border-dark-700">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Error Message</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">No OAuth attempts recorded yet</td></tr>
              )}
              {data?.items.map((attempt) => {
                const meta = OUTCOME_META[attempt.outcome] || { label: attempt.outcome, bg: 'bg-gray-500/15', text: 'text-gray-400' };
                return (
                  <tr key={attempt._id} className="border-b border-dark-700 hover:bg-dark-700/40 transition-colors">
                    <td className="px-4 py-3">
                      {attempt.creator ? (
                        <button
                          onClick={() => navigate(`/influencers/${attempt.creator!._id}`)}
                          className="text-left hover:text-primary transition-colors"
                        >
                          <div className="font-medium text-gray-100">@{attempt.creator.username}</div>
                          <div className="text-xs text-gray-500">{attempt.creator.name}</div>
                        </button>
                      ) : (
                        <span className="text-gray-500">— (invalid state, creator unknown)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      {attempt.errorMessage ? (
                        <div className="text-xs text-gray-400 italic break-words" title={attempt.errorMessage}>
                          {attempt.errorMessage.length > 100 ? attempt.errorMessage.slice(0, 100) + '…' : attempt.errorMessage}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtTimeAgo(attempt.attemptedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700 text-xs text-gray-400">
            <div>
              Showing <span className="text-gray-200">{(data.page - 1) * data.limit + 1}</span>
              –
              <span className="text-gray-200">{Math.min(data.page * data.limit, data.total)}</span>
              {' '}of <span className="text-gray-200">{data.total}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="px-3 py-1">
                Page {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ── TrustLens Auto-Resync panel ───────────────────────────────────────────
// Surfaces the scheduler state (next run, current/last run, IG rate-limit
// quota), lets the admin manually trigger a run, and shows recent per-creator
// sync activity. Polls /status every 30s so a running sync's progress
// counters refresh without a manual reload.

interface TrustLensAutoSyncViewProps {
  BASE: string;
  apiHeaders: () => Record<string, string>;
  navigate: (path: string) => void;
}

const TrustLensAutoSyncView: React.FC<TrustLensAutoSyncViewProps> = ({ BASE, apiHeaders, navigate }) => {
  const [statusData, setStatusData] = useState<AutoSyncStatusResponse | null>(null);
  const [history, setHistory] = useState<SyncRun[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/social/admin/trustlens-sync/status`, { headers: apiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatusData(await res.json());
    } catch (e: any) {
      setError(e.message || 'Failed to load status');
    }
  }, [BASE, apiHeaders]);

  const fetchHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(historyPage), limit: String(historyLimit) });
      const res = await fetch(`${BASE}/social/admin/trustlens-sync/runs?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setHistory(body.items || []);
      setHistoryTotal(body.total || 0);
    } catch (e: any) {
      setError(e.message || 'Failed to load history');
    }
  }, [BASE, apiHeaders, historyPage, historyLimit]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatus(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchStatus, fetchHistory]);

  // Poll while a sync is running so progress counters update live
  useEffect(() => {
    if (!statusData?.is_running) return;
    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, 30_000);
    return () => clearInterval(interval);
  }, [statusData?.is_running, fetchStatus, fetchHistory]);

  const handleTrigger = async () => {
    if (statusData?.is_running) {
      setError('A sync is already running — wait for it to finish or cancel it first.');
      return;
    }
    if (!window.confirm('Manually start a TrustLens sync for all approved creators?\n\nIG calls take ~20s each; a full run can take 30-60 min.')) return;
    setTriggering(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/social/admin/trustlens-sync/trigger`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ notes: 'Manually triggered from CC-Admin' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await fetchStatus();
      await fetchHistory();
    } catch (e: any) {
      setError(e.message || 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  };

  const handleCancel = async (runId: string) => {
    if (!window.confirm('Cancel this running sync? In-flight platform calls will still complete, but no new ones will start.')) return;
    try {
      const res = await fetch(`${BASE}/social/admin/trustlens-sync/cancel/${runId}`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchStatus();
      await fetchHistory();
    } catch (e: any) {
      setError(e.message || 'Cancel failed');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-500 py-12">Loading auto-resync state…</div>;
  }

  const lastRun = statusData?.latest_run;
  const running = statusData?.is_running ? statusData?.running_run : null;
  const ig = statusData?.ig_rate_limit;
  const totalHistoryPages = Math.max(1, Math.ceil(historyTotal / historyLimit));

  return (
    <>
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Status cards row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {/* Next run */}
        <div className="px-4 py-3 rounded-lg border bg-dark-800 border-dark-700">
          <div className="text-xs uppercase tracking-wide opacity-70 font-semibold text-gray-400">Next Scheduled Run</div>
          <div className="text-lg font-bold mt-1 text-gray-100">
            {statusData?.next_scheduled_at ? new Date(statusData.next_scheduled_at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Every other Sunday, 03:00 PKT</div>
        </div>

        {/* Last run */}
        <div className={`px-4 py-3 rounded-lg border ${runStatusBorder(lastRun?.status)}`}>
          <div className="text-xs uppercase tracking-wide opacity-70 font-semibold">Last Run</div>
          {lastRun ? (
            <>
              <div className="text-lg font-bold mt-1">
                {fmtTimeAgo(lastRun.started_at || lastRun.createdAt)} {runStatusBadge(lastRun.status)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {summarizeRunCounters(lastRun)}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 mt-1">Never run</div>
          )}
        </div>

        {/* IG quota */}
        <div className="px-4 py-3 rounded-lg border bg-dark-800 border-dark-700">
          <div className="text-xs uppercase tracking-wide opacity-70 font-semibold text-gray-400">Instagram API Quota</div>
          <div className="text-lg font-bold mt-1 text-gray-100">
            {ig ? `${ig.calls_in_window} / ${ig.daily_cap}` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {ig?.in_backoff ? (
              <span className="text-amber-400">Backoff active (level {ig.backoff_level})</span>
            ) : ig?.last_call_ended_at ? (
              `Last call: ${fmtTimeAgo(ig.last_call_ended_at)}`
            ) : (
              'Idle'
            )}
          </div>
        </div>

        {/* Manual trigger */}
        <div className="px-4 py-3 rounded-lg border bg-dark-800 border-dark-700 flex flex-col">
          <div className="text-xs uppercase tracking-wide opacity-70 font-semibold text-gray-400">Manual Trigger</div>
          <button
            onClick={handleTrigger}
            disabled={triggering || !!statusData?.is_running}
            className="mt-2 px-3 py-2 rounded bg-primary hover:bg-primary/80 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {triggering ? 'Starting…' : statusData?.is_running ? 'Sync in progress' : 'Start sync now'}
          </button>
        </div>
      </div>

      {/* Running run progress panel */}
      {running && (
        <div className="mb-6 px-5 py-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-blue-200 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Sync in progress
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                Started {fmtTimeAgo(running.started_at)} · Triggered by {running.triggered_by === 'cron' ? 'scheduler' : `admin (${running.triggered_by_user || 'unknown'})`}
              </div>
            </div>
            <button
              onClick={() => handleCancel(running._id)}
              className="px-3 py-1.5 rounded bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <PlatformProgressBlock label="Instagram" counter={running.instagram} dot="bg-fuchsia-500" />
            <PlatformProgressBlock label="YouTube"   counter={running.youtube}   dot="bg-red-500" />
            <PlatformProgressBlock label="TikTok"    counter={running.tiktok}    dot="bg-pink-500" />
          </div>
        </div>
      )}

      {/* History table */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Sync History</h3>
        <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-dark-900 border-b border-dark-700">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Eligible</th>
                  <th className="px-4 py-3 font-medium">Processed</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No sync runs yet</td></tr>
                )}
                {history.map((run) => {
                  const processed = (run.instagram?.processed || 0) + (run.youtube?.processed || 0) + (run.tiktok?.processed || 0);
                  return (
                    <React.Fragment key={run._id}>
                      <tr
                        className="border-b border-dark-700 hover:bg-dark-700/40 transition-colors cursor-pointer"
                        onClick={() => setExpandedRunId(expandedRunId === run._id ? null : run._id)}
                      >
                        <td className="px-4 py-3 text-xs text-gray-300">
                          {new Date(run.started_at || run.createdAt).toLocaleString('en-PK', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {run.triggered_by === 'cron'
                            ? <span className="text-gray-400">Scheduler</span>
                            : <span className="text-amber-400">Manual</span>
                          }
                        </td>
                        <td className="px-4 py-3">{runStatusBadge(run.status)}</td>
                        <td className="px-4 py-3 text-xs text-gray-300">{run.scope_creators_eligible}</td>
                        <td className="px-4 py-3 text-xs text-gray-300">{processed}</td>
                        <td className="px-4 py-3 text-xs text-gray-300">{fmtDuration(run.duration_ms)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {expandedRunId === run._id ? '▼' : '▶'}
                        </td>
                      </tr>
                      {expandedRunId === run._id && (
                        <tr className="bg-dark-900/50">
                          <td colSpan={7} className="px-4 py-3">
                            <RunDetailExpanded run={run} navigate={navigate} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {historyTotal > historyLimit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700 text-xs text-gray-400">
              <div>
                Showing <span className="text-gray-200">{(historyPage - 1) * historyLimit + 1}</span>
                –
                <span className="text-gray-200">{Math.min(historyPage * historyLimit, historyTotal)}</span>
                {' '}of <span className="text-gray-200">{historyTotal}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="px-3 py-1 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1">Page {historyPage} / {totalHistoryPages}</span>
                <button
                  onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyPage >= totalHistoryPages}
                  className="px-3 py-1 rounded bg-dark-700 hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent per-creator syncs feed */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Recent Creator Profile Updates</h3>
        <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
          {(statusData?.recent_syncs || []).length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">No sync activity yet</div>
          ) : (
            <ul className="divide-y divide-dark-700">
              {(statusData?.recent_syncs || []).map((row) => {
                const meta = PLATFORM_META[row.platform as Platform];
                return (
                  <li key={row._id} className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-dark-700/40 transition-colors">
                    <span className={`w-2 h-2 rounded-full ${meta?.dot || 'bg-gray-500'}`} />
                    {row.creator_profile ? (
                      <button
                        onClick={() => navigate(`/influencers/${row.creator_profile!._id}`)}
                        className="text-left hover:text-primary transition-colors flex-1"
                      >
                        <span className="font-medium text-gray-100">@{row.creator_profile.username}</span>
                        <span className="text-xs text-gray-500 ml-2">{row.creator_profile.name}</span>
                      </button>
                    ) : (
                      <span className="text-gray-500 flex-1">(creator deleted)</span>
                    )}
                    <span className="text-xs text-gray-400">{meta?.label || row.platform}</span>
                    <span className="text-xs text-gray-500">{fmtTimeAgo(row.lastSyncedAt)}</span>
                    {row.lastSyncStatus !== 'ok' && (
                      <span className="text-xs text-amber-400">{row.lastSyncStatus}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

// ── Helpers for auto-resync panel ────────────────────────────────────────────

function runStatusBorder(status?: SyncRun['status']): string {
  switch (status) {
    case 'completed': return 'bg-green-500/10 border-green-500/30 text-green-300';
    case 'partial':   return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
    case 'failed':    return 'bg-red-500/10 border-red-500/30 text-red-300';
    case 'running':   return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
    default:          return 'bg-dark-800 border-dark-700 text-gray-300';
  }
}

function runStatusBadge(status: SyncRun['status']) {
  const map: Record<SyncRun['status'], { bg: string; text: string; label: string }> = {
    queued:    { bg: 'bg-gray-500/15',  text: 'text-gray-400',   label: 'Queued' },
    running:   { bg: 'bg-blue-500/15',  text: 'text-blue-300',   label: 'Running' },
    completed: { bg: 'bg-green-500/15', text: 'text-green-400',  label: 'Completed' },
    partial:   { bg: 'bg-amber-500/15', text: 'text-amber-400',  label: 'Partial' },
    failed:    { bg: 'bg-red-500/15',   text: 'text-red-400',    label: 'Failed' },
  };
  const m = map[status] || map.queued;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function summarizeRunCounters(run: SyncRun): string {
  const totals = ['instagram', 'youtube', 'tiktok'].reduce(
    (acc, p) => {
      const c = (run as any)[p] as PlatformCounter | undefined;
      if (c) {
        acc.processed += c.processed || 0;
        acc.succeeded += c.succeeded || 0;
        acc.failed    += c.failed || 0;
      }
      return acc;
    },
    { processed: 0, succeeded: 0, failed: 0 }
  );
  return `${totals.succeeded} succeeded, ${totals.failed} failed (of ${totals.processed})`;
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

const PlatformProgressBlock: React.FC<{ label: string; counter?: PlatformCounter; dot: string }> = ({ label, counter, dot }) => {
  const eligible = counter?.eligible || 0;
  const processed = counter?.processed || 0;
  const pct = eligible ? Math.min(100, Math.round((processed / eligible) * 100)) : 0;
  return (
    <div className="px-3 py-2 rounded bg-dark-800 border border-dark-700">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="font-medium text-gray-200">{label}</span>
        <span className="text-gray-500 ml-auto">{processed} / {eligible}</span>
      </div>
      <div className="w-full bg-dark-700 rounded-full h-1.5 overflow-hidden">
        <div className="bg-primary h-1.5 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex gap-3 text-xs mt-1.5 text-gray-500">
        <span className="text-green-400">✓ {counter?.succeeded || 0}</span>
        {(counter?.failed || 0) > 0 && <span className="text-red-400">✕ {counter?.failed || 0}</span>}
        {(counter?.skipped || 0) > 0 && <span className="text-amber-400">⊘ {counter?.skipped || 0}</span>}
      </div>
    </div>
  );
};

// Expanded run-detail row — shows per-platform breakdown + error samples
const RunDetailExpanded: React.FC<{ run: SyncRun; navigate: (path: string) => void }> = ({ run, navigate }) => {
  return (
    <div className="text-xs space-y-3 py-1">
      <div className="grid grid-cols-3 gap-3">
        <PlatformProgressBlock label="Instagram" counter={run.instagram} dot="bg-fuchsia-500" />
        <PlatformProgressBlock label="YouTube"   counter={run.youtube}   dot="bg-red-500" />
        <PlatformProgressBlock label="TikTok"    counter={run.tiktok}    dot="bg-pink-500" />
      </div>
      {run.notes && (
        <div className="text-gray-400 italic">Notes: {run.notes}</div>
      )}
      {run.errors && run.errors.length > 0 && (
        <div>
          <div className="text-gray-400 mb-1.5">Errors (last {run.errors.length}):</div>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {run.errors.slice(-15).reverse().map((e, idx) => (
              <li key={idx} className="text-gray-500">
                <button
                  onClick={() => e.creator_id && navigate(`/influencers/${e.creator_id}`)}
                  className="text-primary hover:underline"
                >
                  @{e.username}
                </button>
                <span className="text-gray-600"> · {e.platform} · </span>
                <span className="text-red-400/80">{e.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SocialSyncStatus;
