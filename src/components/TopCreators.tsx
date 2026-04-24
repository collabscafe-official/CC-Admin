import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ANALYTICS_CONFIG from '../config/analyticsService';

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
});

type SortKey = 'views' | 'clicks' | 'favorites' | 'followers' | 'score';
type DayRange = '30' | '60' | '90' | 'all';

interface Creator {
  _id: string;
  username?: string;
  name?: string;
  profile_image?: string;
  profile_title?: string;
  city?: string;
  country?: string;
}

interface TopCreatorItem {
  rank: number;
  creator: Creator | null;
  impressions: number;
  clicks: number;
  favoritesCount: number;
  totalFollowers: number;
  avgEngagementRate: number;
  avgTrustScore: number;
  platforms: string[];
}

interface ApiResponse {
  items: TopCreatorItem[];
  total: number;
  page: number;
  limit: number;
  sort: string;
  days: string;
}

function fmtNumber(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function platformIcon(p: string): string {
  const key = p.toLowerCase();
  if (key.includes('youtube')) return 'fab fa-youtube';
  if (key.includes('insta')) return 'fab fa-instagram';
  if (key.includes('tiktok')) return 'fab fa-tiktok';
  return 'fas fa-globe';
}

function platformColor(p: string): string {
  const key = p.toLowerCase();
  if (key.includes('youtube')) return 'text-red-500';
  if (key.includes('insta')) return 'text-pink-500';
  if (key.includes('tiktok')) return 'text-gray-100';
  return 'text-gray-400';
}

const SORT_TABS: { key: SortKey; label: string; description: string }[] = [
  { key: 'views', label: 'Profile Views', description: 'By total profile impressions' },
  { key: 'clicks', label: 'Profile Clicks', description: 'By clicks to creator profile' },
  { key: 'favorites', label: 'Favorites', description: 'Most favorited by brands' },
  { key: 'followers', label: 'Followers', description: 'Total followers across platforms' },
  { key: 'score', label: 'Trust Score', description: 'Highest audience quality' },
];

const DAY_RANGES: { key: DayRange; label: string }[] = [
  { key: '30', label: 'Last 30 days' },
  { key: '60', label: 'Last 60 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
];

const TopCreators: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState<SortKey>('views');
  const [days, setDays] = useState<DayRange>('30');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        sort,
        days,
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`${BASE}/social/admin/top-creators?${params}`, { headers: apiHeaders() });
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
  }, [sort, days, page, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const activeSortTab = SORT_TABS.find((t) => t.key === sort) ?? SORT_TABS[0];

  return (
    <div className="text-gray-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Top Creators</h1>
        <p className="text-sm text-gray-400">
          Ranked leaderboard of creators across engagement, reach, and audience quality.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          {/* Sort tabs */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sort by</p>
            <div className="flex flex-wrap gap-1 bg-dark-900 border border-dark-700 rounded-lg p-1">
              {SORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setSort(tab.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    sort === tab.key
                      ? 'bg-gradient-to-r from-primary to-primary-accent text-white shadow'
                      : 'text-gray-400 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Date range</p>
            <div className="flex gap-1 bg-dark-900 border border-dark-700 rounded-lg p-1">
              {DAY_RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => { setDays(r.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    days === r.key
                      ? 'bg-dark-700 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-dark-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Search</p>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Username or name…"
              className="w-64 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-3">
          {activeSortTab.description} · {data?.days === 'all' ? 'All time' : `Last ${data?.days || days} days`}
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
          <i className="fas fa-exclamation-circle mr-2" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-900 border-b border-dark-700">
              <tr className="text-gray-400 uppercase text-xs">
                <th className="px-4 py-3 text-left font-semibold w-12">#</th>
                <th className="px-4 py-3 text-left font-semibold">Creator</th>
                <th className="px-4 py-3 text-right font-semibold">Views</th>
                <th className="px-4 py-3 text-right font-semibold">Clicks</th>
                <th className="px-4 py-3 text-right font-semibold">Favorites</th>
                <th className="px-4 py-3 text-right font-semibold">Followers</th>
                <th className="px-4 py-3 text-right font-semibold">Engagement</th>
                <th className="px-4 py-3 text-right font-semibold">Trust</th>
                <th className="px-4 py-3 text-left font-semibold">Platforms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading && !data && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-primary mx-auto mb-2" />
                    Loading...
                  </td>
                </tr>
              )}

              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    No creators found for this view.
                  </td>
                </tr>
              )}

              {data?.items.map((item) => {
                const c = item.creator;
                if (!c) return null;
                const isTop3 = item.rank <= 3;
                const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
                return (
                  <tr
                    key={c._id}
                    onClick={() => navigate(`/influencers/${c._id}`)}
                    className="hover:bg-dark-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className={`text-lg font-bold ${isTop3 ? rankColors[item.rank - 1] : 'text-gray-500'}`}>
                        {item.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.profile_image ? (
                          <img
                            src={c.profile_image}
                            alt={c.name}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0 text-xs text-gray-400">
                            {c.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{c.name || '—'}</div>
                          <div className="text-xs text-gray-500 truncate">@{c.username || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right ${sort === 'views' ? 'font-bold text-primary-accent' : 'text-gray-300'}`}>
                      {fmtNumber(item.impressions)}
                    </td>
                    <td className={`px-4 py-3 text-right ${sort === 'clicks' ? 'font-bold text-primary-accent' : 'text-gray-300'}`}>
                      {fmtNumber(item.clicks)}
                    </td>
                    <td className={`px-4 py-3 text-right ${sort === 'favorites' ? 'font-bold text-primary-accent' : 'text-gray-300'}`}>
                      {fmtNumber(item.favoritesCount)}
                    </td>
                    <td className={`px-4 py-3 text-right ${sort === 'followers' ? 'font-bold text-primary-accent' : 'text-gray-300'}`}>
                      {fmtNumber(item.totalFollowers)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {item.avgEngagementRate > 0 ? `${item.avgEngagementRate}%` : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right ${sort === 'score' ? 'font-bold text-primary-accent' : 'text-gray-300'}`}>
                      {item.avgTrustScore > 0 ? item.avgTrustScore : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {item.platforms.length === 0 ? (
                          <span className="text-gray-600 text-xs">—</span>
                        ) : (
                          item.platforms.map((p) => (
                            <i key={p} className={`${platformIcon(p)} ${platformColor(p)}`} title={p} />
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700 bg-dark-900">
            <div className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-dark-700 text-xs font-medium text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-600"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-xs text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded bg-dark-700 text-xs font-medium text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-600"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopCreators;
