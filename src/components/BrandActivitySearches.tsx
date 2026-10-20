import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ANALYTICS_CONFIG from '../config/analyticsService';
import { adminServiceHeaders } from '../config/adminServiceHeaders';

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  ...adminServiceHeaders(API_KEY),
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
  // CTR + AI-ranking signals added when backend joins explore_results_served
  ranked_by_distribution?: {
    cc_pixels_search: number;
    cc_pixels: number;
    showcase: number;
    lifo: number;
  };
  zero_result_count?: number;
  sample_top_5?: string[];
  sample_ranked_by?: string;
  clicks_total?: number;
  sessions_that_clicked?: number;
  ctr_pct?: number;
  avg_click_rank?: number | null;
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
                <th className="text-left px-4 py-3 font-medium">AI</th>
                <th className="text-right px-4 py-3 font-medium" title="How often this query was submitted">#</th>
                <th className="text-right px-4 py-3 font-medium" title="Click-through rate: % of searches where a top result was clicked">CTR</th>
                <th className="text-right px-4 py-3 font-medium" title="Average rank-position of clicked results (lower is better)">Rank</th>
                <th className="text-left px-4 py-3 font-medium" title="First 5 creators the AI returned">Top 5 shown</th>
                <th className="text-left px-4 py-3 font-medium">Searched by</th>
                <th className="text-left px-4 py-3 font-medium">Last</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No searches recorded in this range yet.</td></tr>
              )}
              {!loading && items.map((row) => {
                const referral = isLikelyReferral(row);
                const zeroResult = (row.zero_result_count ?? 0) > 0 && row.zero_result_count === row.count;
                const rb = row.sample_ranked_by || 'lifo';
                const rbColor =
                  rb === 'cc_pixels_search' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                  rb === 'cc_pixels'        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                  rb === 'showcase'         ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' :
                                              'bg-gray-500/20 text-gray-300 border-gray-500/40';
                const rbLabel =
                  rb === 'cc_pixels_search' ? 'AI SEARCH' :
                  rb === 'cc_pixels'        ? 'AI BRAND' :
                  rb === 'showcase'         ? 'SHOWCASE' :
                                              'LIFO';
                const ctr = row.ctr_pct ?? 0;
                const ctrColor =
                  ctr >= 40 ? 'text-emerald-300' :
                  ctr >= 15 ? 'text-amber-300' :
                  ctr > 0   ? 'text-gray-300' :
                              'text-red-300';
                return (
                  <tr key={row.query} className={`hover:bg-dark-700/40 ${referral ? 'bg-amber-500/5' : ''} ${zeroResult ? 'bg-red-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-white">{row.query}</span>
                        {referral && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            REFERRAL?
                          </span>
                        )}
                        {zeroResult && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40" title="Zero results every time this was searched">
                            0 RESULTS
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${rbColor}`}>
                        {rbLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white">{row.count}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${ctrColor}`} title={`${row.sessions_that_clicked || 0} of ${row.count} searches led to a click`}>
                      {row.ctr_pct != null ? `${row.ctr_pct}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-300" title="Average position of clicked results — lower is better">
                      {row.avg_click_rank != null ? row.avg_click_rank.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {(row.sample_top_5 || []).slice(0, 5).map((u, i) => (
                          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded bg-dark-700 text-[11px] font-mono text-gray-400" title={`Rank #${i + 1}`}>
                            {i + 1}.&nbsp;@{u.replace(/^@+/, '')}
                          </span>
                        ))}
                        {(!row.sample_top_5 || row.sample_top_5.length === 0) && (
                          <span className="text-xs text-gray-600 italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {row.brands.slice(0, 2).map((b) => (
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
                            <span className="truncate max-w-[100px]">{b.brand_name || b.email}</span>
                          </button>
                        ))}
                        {row.brands.length > 2 && (
                          <span className="text-xs text-gray-500 px-1 py-0.5">+{row.brands.length - 2}</span>
                        )}
                        {row.anonymous_count > 0 && (
                          <span className="text-xs text-gray-500 px-1 py-0.5">+{row.anonymous_count} anon</span>
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
        <div className="px-4 py-3 border-t border-dark-700 bg-dark-900/50 text-xs text-gray-500 flex items-center gap-4 flex-wrap">
          <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" /> CTR ≥ 40% = good match</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" /> 15–40% = ok</span>
          <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" /> &lt; 15% or zero results = investigate</span>
        </div>
      </div>
    </div>
  );
};

export default BrandActivitySearches;
