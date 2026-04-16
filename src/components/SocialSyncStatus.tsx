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

  const [platform] = useState<string>('youtube');
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [sort, setSort] = useState<'lastSyncedAt' | 'score' | 'followers'>('lastSyncedAt');
  const [refreshing, setRefreshing] = useState<string>(''); // _id currently refreshing

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
    fetchList();
  }, [fetchList]);

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
        {/* Platform pill (only YouTube for now) */}
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-700 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          YouTube
        </span>

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
                <th className="px-4 py-3 font-medium text-right">Followers</th>
                <th className="px-4 py-3 font-medium text-center">Score</th>
                <th className="px-4 py-3 font-medium">Last Synced</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No matching records</td></tr>
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
                  <td className="px-4 py-3 text-right text-gray-300">{fmtNumber(item.followers)}</td>
                  <td className="px-4 py-3 text-center">{gradeBadge(item.audienceQualityGrade, item.audienceQualityScore)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtTimeAgo(item.lastSyncedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => handleRefreshOne(item)}
                        disabled={refreshing === item._id || !item.creator}
                        className="px-2 py-1 text-xs rounded bg-dark-700 hover:bg-primary hover:text-white text-gray-300 transition-colors disabled:opacity-50"
                        title="Re-fetch from YouTube"
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

export default SocialSyncStatus;
