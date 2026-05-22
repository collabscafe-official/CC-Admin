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

type View = 'sync' | 'attempts';

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

export default SocialSyncStatus;
