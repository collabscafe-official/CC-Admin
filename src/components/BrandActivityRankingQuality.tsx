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

type RangeKey = '7d' | '30d' | '90d';

interface PlatformKPIs {
  serves: number;
  impressions: number;
  clicks: number;
  ctr_pct: number;
  avg_click_rank: number | null;
  pct_top5_clicks: number;
  pct_top10_clicks: number;
  zero_result_serves: number;
  ranked_by_distribution: {
    cc_pixels_search: number;
    cc_pixels: number;
    showcase: number;
    lifo: number;
  };
}

interface Funnel {
  signups: number;
  first_explore: number;
  any_creator_click: number;
  any_chat_intent: number;
  payment_started: number;
  payment_completed: number;
  pct_signup_to_explore: number;
  pct_explore_to_click: number;
  pct_click_to_chat: number;
  pct_chat_to_payment: number;
}

interface TTFE {
  sample_size: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  fast_clickers_pct: number;
  fast_clicker_threshold_sec: number;
}

interface BrandRow {
  brand_id: string;
  brand_name?: string;
  email?: string;
  signed_up?: string;
  session_count: number;
  last_active: string;
  serves: number;
  impressions: number;
  clicks: number;
  ctr_pct: number;
  avg_click_rank: number | null;
  chat_clicks: number;
}

interface ApiResponse {
  success: boolean;
  range: { from: string; to: string };
  platform_kpis: PlatformKPIs;
  funnel: Funnel;
  time_to_first_explore_sec: TTFE;
  per_brand: BrandRow[];
}

type SortKey = 'last_active' | 'impressions' | 'clicks' | 'ctr_pct' | 'avg_click_rank' | 'session_count';

function rangeToParams(r: RangeKey): URLSearchParams {
  const params = new URLSearchParams();
  const now = new Date();
  const days = r === '7d' ? 7 : r === '30d' ? 30 : 90;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  params.set('from', from.toISOString());
  params.set('to', now.toISOString());
  return params;
}

function fmtSeconds(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

function fmtTimeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

// Color-code CTR against industry benchmarks: <2% weak, 2-5% ok, 5%+ strong
function ctrColor(ctr: number): string {
  if (ctr >= 5) return 'text-emerald-400';
  if (ctr >= 2) return 'text-amber-400';
  return 'text-rose-400';
}
// Avg rank: lower is better. <10 strong, 10-20 ok, 20+ weak
function rankColor(rank: number | null): string {
  if (rank == null) return 'text-gray-500';
  if (rank <= 10) return 'text-emerald-400';
  if (rank <= 20) return 'text-amber-400';
  return 'text-rose-400';
}

const KpiCard: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
    <div className="text-2xl font-bold">{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </div>
);

const FunnelBar: React.FC<{ label: string; value: number; max: number; pctFromPrev?: number }> = ({ label, value, max, pctFromPrev }) => {
  const widthPct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">
          <span className="font-semibold text-white">{value}</span>
          {pctFromPrev != null && <span className="ml-2 text-xs text-gray-500">({pctFromPrev.toFixed(1)}%)</span>}
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded">
        <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400 rounded" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
};

const BrandActivityRankingQuality: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeKey>('7d');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('impressions');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async (r: RangeKey) => {
    setLoading(true);
    setErr(null);
    try {
      const params = rangeToParams(r);
      const res = await fetch(`${BASE}/events/brand-activity/ranking-quality?${params}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  const sortedRows = useMemo(() => {
    if (!data?.per_brand) return [];
    const rows = [...data.per_brand];
    rows.sort((a, b) => {
      const av = (a[sortKey] ?? -Infinity) as any;
      const bv = (b[sortKey] ?? -Infinity) as any;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const sortIcon = (k: SortKey) => sortKey === k ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  return (
    <div className="p-6 text-white">
      <button
        onClick={() => navigate('/brand-activity')}
        className="text-sm text-gray-400 hover:text-white mb-4"
      >
        ← All brand activity
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Ranking Quality</h1>
          <p className="text-sm text-gray-400 mt-1">AI ranking performance + conversion funnel across all brands.</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as RangeKey[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-sm rounded border ${range === r ? 'bg-blue-600 border-blue-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-gray-400 text-sm">Loading…</div>}
      {err && <div className="text-rose-400 text-sm mb-4">Error: {err}</div>}

      {data && (
        <>
          {/* Platform KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KpiCard
              label="CTR"
              value={<span className={ctrColor(data.platform_kpis.ctr_pct)}>{data.platform_kpis.ctr_pct}%</span>}
              sub={`${data.platform_kpis.clicks} clicks / ${data.platform_kpis.impressions} impressions`}
            />
            <KpiCard
              label="Avg click rank"
              value={<span className={rankColor(data.platform_kpis.avg_click_rank)}>{data.platform_kpis.avg_click_rank ?? '—'}</span>}
              sub={`${data.platform_kpis.pct_top5_clicks}% in top 5 · ${data.platform_kpis.pct_top10_clicks}% in top 10`}
            />
            <KpiCard
              label="Explore serves"
              value={data.platform_kpis.serves}
              sub={`${data.platform_kpis.zero_result_serves} zero-result`}
            />
            <KpiCard
              label="Fast-clickers"
              value={`${data.time_to_first_explore_sec.fast_clickers_pct}%`}
              sub={`of ${data.time_to_first_explore_sec.sample_size} new signups clicked Explore within ${data.time_to_first_explore_sec.fast_clicker_threshold_sec}s`}
            />
          </div>

          {/* Ranked-by distribution */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Ranked by</div>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-500">cc_pixels:</span> <span className="font-semibold">{data.platform_kpis.ranked_by_distribution.cc_pixels}</span></div>
              <div><span className="text-gray-500">cc_pixels_search:</span> <span className="font-semibold">{data.platform_kpis.ranked_by_distribution.cc_pixels_search}</span></div>
              <div><span className="text-gray-500">showcase:</span> <span className="font-semibold">{data.platform_kpis.ranked_by_distribution.showcase}</span></div>
              <div><span className="text-gray-500">lifo (fallback):</span> <span className="font-semibold">{data.platform_kpis.ranked_by_distribution.lifo}</span></div>
            </div>
          </div>

          {/* Funnel */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Conversion funnel ({range})</div>
            {data.funnel.signups > 0 ? (
              <>
                <FunnelBar label="Signups" value={data.funnel.signups} max={data.funnel.signups} />
                <FunnelBar label="→ Hit Explore" value={data.funnel.first_explore} max={data.funnel.signups} pctFromPrev={data.funnel.pct_signup_to_explore} />
                <FunnelBar label="→ Clicked a Creator" value={data.funnel.any_creator_click} max={data.funnel.signups} pctFromPrev={data.funnel.pct_explore_to_click} />
                <FunnelBar label="→ Clicked Message/Chat" value={data.funnel.any_chat_intent} max={data.funnel.signups} pctFromPrev={data.funnel.pct_click_to_chat} />
                <FunnelBar label="→ Payment Started" value={data.funnel.payment_started} max={data.funnel.signups} />
                <FunnelBar label="→ Payment Completed" value={data.funnel.payment_completed} max={data.funnel.signups} />
              </>
            ) : (
              <div className="text-gray-500 text-sm">No new signups in this window.</div>
            )}
          </div>

          {/* Time to first explore */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Time from signup to first Explore</div>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div><div className="text-gray-500 text-xs">p25</div><div className="font-semibold">{fmtSeconds(data.time_to_first_explore_sec.p25)}</div></div>
              <div><div className="text-gray-500 text-xs">median</div><div className="font-semibold">{fmtSeconds(data.time_to_first_explore_sec.median)}</div></div>
              <div><div className="text-gray-500 text-xs">p75</div><div className="font-semibold">{fmtSeconds(data.time_to_first_explore_sec.p75)}</div></div>
              <div><div className="text-gray-500 text-xs">sample</div><div className="font-semibold">{data.time_to_first_explore_sec.sample_size}</div></div>
            </div>
          </div>

          {/* Per-brand table */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Per-brand ranking quality</div>
              <div className="text-xs text-gray-500">{sortedRows.length} brands with activity in window</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase tracking-wider bg-gray-950">
                  <tr>
                    <th className="text-left px-4 py-2">Brand</th>
                    <th className="text-right px-4 py-2 cursor-pointer" onClick={() => toggleSort('session_count')}>Sessions{sortIcon('session_count')}</th>
                    <th className="text-right px-4 py-2 cursor-pointer" onClick={() => toggleSort('impressions')}>Impressions{sortIcon('impressions')}</th>
                    <th className="text-right px-4 py-2 cursor-pointer" onClick={() => toggleSort('clicks')}>Clicks{sortIcon('clicks')}</th>
                    <th className="text-right px-4 py-2 cursor-pointer" onClick={() => toggleSort('ctr_pct')}>CTR{sortIcon('ctr_pct')}</th>
                    <th className="text-right px-4 py-2 cursor-pointer" onClick={() => toggleSort('avg_click_rank')}>Avg rank{sortIcon('avg_click_rank')}</th>
                    <th className="text-right px-4 py-2">Chat clicks</th>
                    <th className="text-right px-4 py-2 cursor-pointer" onClick={() => toggleSort('last_active')}>Last active{sortIcon('last_active')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(r => (
                    <tr
                      key={r.brand_id}
                      onClick={() => navigate(`/brand-activity/${r.brand_id}`)}
                      className="border-t border-gray-800 hover:bg-gray-800/40 cursor-pointer"
                    >
                      <td className="px-4 py-2">
                        <div className="font-medium text-white">{r.brand_name || '(no name)'}</div>
                        <div className="text-xs text-gray-500">{r.email || '—'}</div>
                      </td>
                      <td className="text-right px-4 py-2">{r.session_count}</td>
                      <td className="text-right px-4 py-2">{r.impressions}</td>
                      <td className="text-right px-4 py-2">{r.clicks}</td>
                      <td className={`text-right px-4 py-2 ${ctrColor(r.ctr_pct)}`}>{r.ctr_pct}%</td>
                      <td className={`text-right px-4 py-2 ${rankColor(r.avg_click_rank)}`}>{r.avg_click_rank ?? '—'}</td>
                      <td className="text-right px-4 py-2 text-gray-400">{r.chat_clicks}</td>
                      <td className="text-right px-4 py-2 text-gray-500">{fmtTimeAgo(r.last_active)}</td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-gray-500 py-6">No brand activity in this window.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BrandActivityRankingQuality;
