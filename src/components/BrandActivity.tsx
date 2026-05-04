import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ANALYTICS_CONFIG from '../config/analyticsService';

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
});

type Stage = 'all' | 'Browsing' | 'Shortlisted' | 'Cart' | 'Checkout' | 'Paid';
type SortKey = 'last_active' | 'most_events' | 'most_sessions' | 'first_seen';

interface BrandSummary {
  _id: string;
  email: string;
  brand_name: string;
  profile_image?: string;
  country?: string;
  city?: string;
  is_email_verified?: boolean;
}

interface ActivityItem {
  brand_id: string;
  brand: BrandSummary | null;
  last_active: string;
  first_seen: string;
  total_events: number;
  session_count: number;
  stage: 'Browsing' | 'Shortlisted' | 'Cart' | 'Checkout' | 'Paid';
}

interface ApiResponse {
  items: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  summary: Record<string, number>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

const STAGE_STYLES: Record<string, { bg: string; text: string }> = {
  Browsing:    { bg: 'bg-gray-500/15',   text: 'text-gray-300' },
  Shortlisted: { bg: 'bg-blue-500/15',   text: 'text-blue-300' },
  Cart:        { bg: 'bg-amber-500/15',  text: 'text-amber-300' },
  Checkout:    { bg: 'bg-purple-500/15', text: 'text-purple-300' },
  Paid:        { bg: 'bg-green-500/15',  text: 'text-green-300' },
};

function stageBadge(stage: string) {
  const m = STAGE_STYLES[stage] || STAGE_STYLES.Browsing;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${m.bg} ${m.text}`}>
      {stage}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

const SummaryTile: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className={`rounded-lg border px-4 py-3 ${color}`}>
    <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
    <div className="text-2xl font-bold mt-0.5">{fmtNumber(value)}</div>
  </div>
);

const BrandActivity: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stage, setStage] = useState<Stage>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [sort, setSort] = useState<SortKey>('last_active');

  // Debounce search
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
        search: debouncedSearch,
        page: String(page),
        limit: String(limit),
        sort,
      });
      const res = await fetch(`${BASE}/events/brand-activity/list?${params}`, {
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
  }, [debouncedSearch, page, limit, sort]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Filter items client-side by stage (server-side stage filter is partial — see controller)
  const items = data?.items
    ? data.items.filter((i) => stage === 'all' || i.stage === stage)
    : [];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const summary = data?.summary || {};

  return (
    <div className="text-gray-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Brand Activity</h1>
        <p className="text-sm text-gray-400">
          Behavioural log of brands on the platform. Use this to spot drop-off,
          identify cold accounts, and prioritise outreach.
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <SummaryTile label="Total" value={summary.total_active_brands ?? 0} color="bg-dark-800 border-dark-700 text-gray-200" />
        <SummaryTile label="Browsing" value={summary.Browsing ?? 0} color="bg-gray-500/10 border-gray-500/30 text-gray-300" />
        <SummaryTile label="Shortlisted" value={summary.Shortlisted ?? 0} color="bg-blue-500/10 border-blue-500/30 text-blue-300" />
        <SummaryTile label="Cart" value={summary.Cart ?? 0} color="bg-amber-500/10 border-amber-500/30 text-amber-300" />
        <SummaryTile label="Checkout" value={summary.Checkout ?? 0} color="bg-purple-500/10 border-purple-500/30 text-purple-300" />
        <SummaryTile label="Paid" value={summary.Paid ?? 0} color="bg-green-500/10 border-green-500/30 text-green-300" />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex flex-wrap gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1">
          {(['all', 'Browsing', 'Shortlisted', 'Cart', 'Checkout', 'Paid'] as Stage[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStage(s); setPage(1); }}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                stage === s
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brand name or email..."
          className="flex-1 min-w-[220px] bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-primary"
        />

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
          className="bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
        >
          <option value="last_active">Recently active</option>
          <option value="most_events">Most events</option>
          <option value="most_sessions">Most sessions</option>
          <option value="first_seen">Newest</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-dark-900 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Brand</th>
                <th className="text-left px-4 py-3 font-medium">Stage</th>
                <th className="text-right px-4 py-3 font-medium">Events</th>
                <th className="text-right px-4 py-3 font-medium">Sessions</th>
                <th className="text-left px-4 py-3 font-medium">Last active</th>
                <th className="text-left px-4 py-3 font-medium">First seen</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No activity recorded yet.</td></tr>
              )}
              {!loading && items.map((item) => (
                <tr key={item.brand_id} className="hover:bg-dark-700/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.brand?.profile_image ? (
                        <img src={item.brand.profile_image} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs text-gray-400">
                          {item.brand?.brand_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{item.brand?.brand_name || '(missing)'}</div>
                        <div className="text-xs text-gray-500 truncate">{item.brand?.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{stageBadge(item.stage)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtNumber(item.total_events)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtNumber(item.session_count)}</td>
                  <td className="px-4 py-3 text-gray-300">{fmtTimeAgo(item.last_active)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtTimeAgo(item.first_seen)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/brand-activity/${item.brand_id}`)}
                      className="text-primary hover:text-primary-accent text-xs font-medium"
                    >
                      View timeline →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700 text-xs text-gray-400">
            <div>
              Showing {(data.page - 1) * data.limit + 1}–
              {Math.min(data.page * data.limit, data.total)} of {fmtNumber(data.total)}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded bg-dark-700 disabled:opacity-30 hover:bg-dark-600 transition-colors"
              >Prev</button>
              <span className="px-3 py-1">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded bg-dark-700 disabled:opacity-30 hover:bg-dark-600 transition-colors"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandActivity;
