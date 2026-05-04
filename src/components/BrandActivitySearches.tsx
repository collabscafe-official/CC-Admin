import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ANALYTICS_CONFIG from '../config/analyticsService';

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
});

type RangeKey = '7d' | '30d' | '90d' | 'all';

interface BrandRef {
  _id: string;
  brand_name?: string;
  email?: string;
  profile_image?: string;
}

interface SearchRow {
  query: string;
  count: number;
  brand_count: number;
  anonymous_count: number;
  brands: BrandRef[];
  first_at: string;
  last_at: string;
}

interface ApiResponse {
  items: SearchRow[];
  total: number;
}

// ── helpers ────────────────────────────────────────────────────────────────

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

// Heuristic: a single-brand single-word search is likely a creator-name lookup
// (a referral signal). Multi-brand or multi-word queries are generic discovery.
function isLikelyReferral(row: SearchRow): boolean {
  if (row.brand_count !== 1) return false;
  if (row.anonymous_count > 0) return false;
  if (row.count > 5) return false;
  const trimmed = row.query.trim();
  // Single-word, alpha-ish, between 3 and 25 chars
  if (trimmed.includes(' ')) return false;
  if (trimmed.length < 3 || trimmed.length > 25) return false;
  if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(trimmed)) return false;
  return true;
}

function rangeToParams(r: RangeKey): URLSearchParams {
  const params = new URLSearchParams();
  params.set('limit', '200');
  if (r === 'all') return params;
  const days = r === '7d' ? 7 : r === '30d' ? 30 : 90;
  const from = new Date();
  from.setDate(from.getDate() - days);
  params.set('from', from.toISOString());
  return params;
}

// ── component ──────────────────────────────────────────────────────────────

const BrandActivitySearches: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('7d');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = rangeToParams(range);
      const res = await fetch(
        `${BASE}/events/brand-activity/searches?${params}`,
        { headers: apiHeaders() },
      );
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
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const items = data?.items || [];

  const summary = useMemo(() => {
    const total_searches = items.reduce((acc, r) => acc + r.count, 0);
    const referral_count = items.filter(isLikelyReferral).length;
    const distinct_brand_set = new Set<string>();
    for (const r of items) {
      for (const b of r.brands) distinct_brand_set.add(b._id);
    }
    return {
      unique_queries: items.length,
      total_searches,
      referral_count,
      distinct_brands: distinct_brand_set.size,
    };
  }, [items]);

  return (
    <div className="text-gray-100">
      {/* Back link */}
      <button
        onClick={() => navigate('/brand-activity')}
        className="text-primary hover:text-primary-accent text-sm font-medium mb-4 inline-flex items-center gap-1"
      >
        ← All brand activity
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Top Searches</h1>
        <p className="text-sm text-gray-400">
          What brands are typing into the explore search bar. Single-brand
          single-word queries (highlighted) are usually referral signals — a
          brand is looking for a specific creator they heard about.
        </p>
      </div>

      {/* Range pills */}
      <div className="flex gap-1 bg-dark-800 border border-dark-700 rounded-lg p-1 inline-flex mb-6">
        {(['7d', '30d', '90d', 'all'] as RangeKey[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
              range === r
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : r === '90d' ? 'Last 90 days' : 'All time'}
          </button>
        ))}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Unique queries</div>
          <div className="text-2xl font-bold text-white mt-0.5">{summary.unique_queries}</div>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total searches</div>
          <div className="text-2xl font-bold text-white mt-0.5">{summary.total_searches}</div>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Brands searching</div>
          <div className="text-2xl font-bold text-white mt-0.5">{summary.distinct_brands}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-amber-300">Likely referrals</div>
          <div className="text-2xl font-bold text-amber-200 mt-0.5">{summary.referral_count}</div>
        </div>
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
                <th className="text-left px-4 py-3 font-medium">Query</th>
                <th className="text-right px-4 py-3 font-medium">Count</th>
                <th className="text-right px-4 py-3 font-medium">Brands</th>
                <th className="text-left px-4 py-3 font-medium">Searched by</th>
                <th className="text-left px-4 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No searches recorded in this range yet.</td></tr>
              )}
              {!loading && items.map((row) => {
                const referral = isLikelyReferral(row);
                return (
                  <tr key={row.query} className={`hover:bg-dark-700/40 ${referral ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-white">{row.query}</span>
                        {referral && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            REFERRAL?
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{row.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-300">
                      {row.brand_count}
                      {row.anonymous_count > 0 && (
                        <span className="text-gray-500 text-xs"> +{row.anonymous_count} anon</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {row.brands.slice(0, 4).map((b) => (
                          <button
                            key={b._id}
                            onClick={() => navigate(`/brand-activity/${b._id}`)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-dark-700 hover:bg-dark-600 text-xs text-gray-300 hover:text-white transition-colors"
                            title={b.email}
                          >
                            {b.profile_image ? (
                              <img src={b.profile_image} alt="" className="w-4 h-4 rounded-full object-cover" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-dark-600" />
                            )}
                            <span className="truncate max-w-[120px]">{b.brand_name || b.email}</span>
                          </button>
                        ))}
                        {row.brands.length > 4 && (
                          <span className="text-xs text-gray-500 px-2 py-0.5">+{row.brands.length - 4} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtTimeAgo(row.last_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BrandActivitySearches;
