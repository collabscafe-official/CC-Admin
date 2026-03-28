import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts';
import collabs from '../config/collabs';

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes ins-shimmer { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
  .ins-tabs { display: flex; overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,0.07); scrollbar-width: none; gap: 0; }
  .ins-tabs::-webkit-scrollbar { display: none; }
  .ins-tab { padding: 12px 20px; font-size: 13px; font-weight: 500; cursor: pointer; background: none; border: none; border-bottom: 2px solid transparent; color: rgba(255,255,255,0.4); transition: all 0.15s ease; white-space: nowrap; }
  .ins-tab.active { color: #818cf8; border-bottom-color: #4f46e5; }
  .ins-tab:hover:not(.active) { color: rgba(255,255,255,0.7); }
  .ins-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  @media (min-width: 640px) { .ins-stat-grid { grid-template-columns: repeat(3, 1fr); } }
  .ins-stat-grid-4 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  @media (min-width: 1024px) { .ins-stat-grid-4 { grid-template-columns: repeat(4, 1fr); } }
  .ins-chart-row { display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 16px; }
  @media (min-width: 768px) { .ins-chart-row { grid-template-columns: repeat(2, 1fr); } }
  .ins-chart-row-1 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-bottom: 16px; }
`;

// ── Colour palette ────────────────────────────────────────────────────────────

const PALETTE = [
  '#4f46e5','#10b981','#f59e0b','#f43f5e',
  '#7c6edd','#06b6d4','#8b5cf6','#ec4899',
  '#84cc16','#0ea5e9',
];

// ── Dark tooltip ──────────────────────────────────────────────────────────────

const DarkTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a1d2e',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
    }}>
      {label != null && (
        <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', fontSize: 11 }}>{label}</p>
      )}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{
          color: p.color ?? '#818cf8',
          margin: i < payload.length - 1 ? '0 0 3px' : 0,
          fontWeight: 600,
        }}>
          {p.name ? `${p.name}: ` : ''}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

// ── ChartCard ─────────────────────────────────────────────────────────────────

const ChartCard: React.FC<{ title: string; children: React.ReactNode; minH?: number }> = ({
  title, children, minH = 260,
}) => (
  <div style={{
    background: '#242736',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '20px 16px',
  }}>
    <p style={{
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.09em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.35)',
      margin: '0 0 16px',
    }}>
      {title}
    </p>
    <div style={{ minHeight: minH }}>{children}</div>
  </div>
);

// ── StatCard ──────────────────────────────────────────────────────────────────

const InsightStatCard: React.FC<{
  label: string;
  value: string | number;
  accent: string;
  sub?: string;
  subColor?: string;
}> = ({ label, value, accent, sub, subColor }) => (
  <div style={{
    background: '#242736',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    overflow: 'hidden',
  }}>
    <div style={{ height: 3, background: accent }} />
    <div style={{ padding: '18px 16px 14px' }}>
      <p style={{
        fontSize: 26, fontWeight: 700,
        color: 'rgba(255,255,255,0.90)',
        margin: '0 0 5px', lineHeight: 1,
      }}>
        {value}
      </p>
      <p style={{
        fontSize: 11, fontWeight: 500,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.38)',
        margin: 0,
      }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: subColor ?? 'rgba(255,255,255,0.45)', margin: '6px 0 0' }}>{sub}</p>
      )}
    </div>
  </div>
);

// ── Skeletons ─────────────────────────────────────────────────────────────────

const SkeletonGrid: React.FC<{ cols?: number }> = ({ cols = 3 }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${Math.min(cols, 2)}, 1fr)`,
    gap: 12,
    marginBottom: 20,
  }}>
    {Array.from({ length: cols }).map((_, i) => (
      <div key={i} style={{
        height: 100, borderRadius: 12,
        background: 'rgba(255,255,255,0.06)',
        animation: `ins-shimmer 1.6s ease-in-out ${i * 0.1}s infinite`,
      }} />
    ))}
  </div>
);

const SkeletonChart: React.FC = () => (
  <div style={{
    height: 260, borderRadius: 12,
    background: 'rgba(255,255,255,0.06)',
    animation: 'ins-shimmer 1.6s ease-in-out infinite',
  }} />
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function topN(arr: (string | null | undefined)[], n = 8): Array<{ name: string; count: number }> {
  const map: Record<string, number> = {};
  for (const v of arr) {
    if (!v) continue;
    const key = String(v).trim();
    if (!key) continue;
    map[key] = (map[key] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function capitalize(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getFollowerBucket(range: string | null | undefined): string | null {
  if (!range) return null;
  const r = range.toLowerCase();
  if (r.includes('100k') || r.includes('100,000') || r.includes('million') || r.includes('1m')) return '100K+';
  if (r.includes('10k') || r.includes('10,000')) return '10K–100K';
  if (r.includes('1k') || r.includes('1,000')) return '1K–10K';
  return '0–1K';
}

function buildMonthSlots(): Array<{ label: string; year: number; month: number }> {
  const slots = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    slots.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return slots;
}

function countByMonth(items: any[], ...dateFields: string[]): Array<{ label: string; count: number }> {
  const slots = buildMonthSlots();
  const counts: Record<string, number> = {};
  for (const slot of slots) counts[slot.label] = 0;
  for (const item of items) {
    let raw: string | undefined;
    for (const f of dateFields) { if (item[f]) { raw = item[f]; break; } }
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (key in counts) counts[key]++;
  }
  return slots.map(s => ({ label: s.label, count: counts[s.label] }));
}

function isTruthy(v: any): boolean {
  return v === true || v === 1;
}

function parseFollowerMidpoint(range: string | null | undefined): number {
  if (!range) return 0;
  const r = range.toLowerCase().replace(/\s/g, '');
  // handles formats like "100k+", "100k_plus", "100k-", "100000+"
  if (r.includes('100k') || r.includes('100,000') || r.includes('million') || r.includes('1m')) return 150000;
  // handles "10k-100k", "10k_100k", "10k"
  if (r.includes('10k') || r.includes('10,000')) return 55000;
  // handles "1k-10k", "1k_10k", "1k"
  if (r.includes('1k') || r.includes('1,000')) return 5500;
  return 500; // 0–1K default
}

function formatBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = ['Demographics', 'Reach & Influence', 'Growth & Health', 'Brands'];

const axisStyle = { fill: 'rgba(255,255,255,0.42)', fontSize: 11 };
const gridStroke = 'rgba(255,255,255,0.05)';

const Insights: React.FC = () => {
  const [tab, setTab]             = useState(0);
  const [infList, setInfList]     = useState<any[]>([]);
  const [brandList, setBrandList] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [infRes, brandRes] = await Promise.all([
        collabs.get('/admin/influencers/list?limit=2000&page=1'),
        collabs.get('/admin/brands/list?limit=2000&page=1'),
      ]);
      const rawInf = infRes.data?.data;
      const infs   = rawInf?.profiles ?? rawInf?.influencers ?? (Array.isArray(rawInf) ? rawInf : []);
      const rawBrand  = brandRes.data?.data;
      const brands = rawBrand?.profiles ?? rawBrand?.brands ?? (Array.isArray(rawBrand) ? rawBrand : []);
      setInfList(Array.isArray(infs) ? infs : []);
      setBrandList(Array.isArray(brands) ? brands : []);
      setLastUpdated(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Demographics ──────────────────────────────────────────────────────────────

  const demographics = useMemo(() => {
    const countries       = topN(infList.map(i => i.country), 8);
    const cities          = topN(infList.map(i => i.city), 8);
    const genders         = topN(infList.map(i => capitalize(i.gender)), 5);
    const niches          = topN(infList.map(i => i.niche), 8);
    const uniqueCountries = new Set(infList.map(i => i.country).filter(Boolean)).size;
    const uniqueCities    = new Set(infList.map(i => i.city).filter(Boolean)).size;
    const total           = infList.length;
    const complete        = infList.filter(i => isTruthy(i.is_profile_completed)).length;
    const dropout         = total - complete;
    const completionRate  = total > 0 ? Math.round(complete / total * 100) : 0;
    const dropoutRate     = total > 0 ? Math.round(dropout  / total * 100) : 0;
    return { countries, cities, genders, niches, uniqueCountries, uniqueCities, complete, dropout, completionRate, dropoutRate };
  }, [infList]);

  // ── Reach & Influence ─────────────────────────────────────────────────────────

  const reach = useMemo(() => {
    const allHandles: any[] = [];
    for (const inf of infList) {
      if (Array.isArray(inf.social_handles)) allHandles.push(...inf.social_handles);
    }
    const platforms    = topN(allHandles.map(h => capitalize(h.platform)), 8);
    const platformBar  = topN(allHandles.map(h => capitalize(h.platform)), 10);
    const buckets      = ['0–1K', '1K–10K', '10K–100K', '100K+'];
    const bucketMap: Record<string, number> = { '0–1K': 0, '1K–10K': 0, '10K–100K': 0, '100K+': 0 };
    for (const h of allHandles) {
      const b = getFollowerBucket(h.follower_range);
      if (b) bucketMap[b]++;
    }
    const followerBuckets = buckets.map(b => ({ name: b, count: bucketMap[b] }));
    const verified        = infList.filter(i => isTruthy(i.is_email_verified)).length;
    const active          = infList.filter(i => isTruthy(i.is_active)).length;
    // Combined followers via midpoint estimation
    const combinedFollowers = allHandles.reduce((sum, h) => sum + parseFollowerMidpoint(h.follower_range), 0);
    const combinedReach     = Math.round(combinedFollowers * 0.032);
    const total             = infList.length;
    const avgFollowers      = total > 0 ? Math.round(combinedFollowers / total) : 0;
    // Retention = creators who completed profile / total
    const complete          = infList.filter(i => isTruthy(i.is_profile_completed)).length;
    const dropoutCount      = total - complete;
    const retentionRate     = total > 0 ? Math.round(complete / total * 100) : 0;
    return {
      platforms, followerBuckets, platformBar, verified, active, totalHandles: allHandles.length,
      combinedFollowersStr: formatBig(combinedFollowers),
      combinedReachStr:     formatBig(combinedReach),
      avgFollowersStr:      formatBig(avgFollowers),
      retentionRate, dropoutCount,
    };
  }, [infList]);

  // ── Growth & Health ───────────────────────────────────────────────────────────

  const growth = useMemo(() => {
    const monthly    = countByMonth(infList, 'created_date', 'created_at');
    const approved   = infList.filter(i => isTruthy(i.is_approved_by_admin)).length;
    const complete   = infList.filter(i => isTruthy(i.is_profile_completed)).length;
    const pending    = infList.filter(i =>
      isTruthy(i.is_profile_completed) && !isTruthy(i.is_approved_by_admin)
    ).length;
    const funnel = [
      { name: 'Total',    count: infList.length },
      { name: 'Active',   count: infList.filter(i => isTruthy(i.is_active)).length },
      { name: 'Complete', count: complete },
      { name: 'Approved', count: approved },
    ];
    const now = Date.now();
    const agingMap: Record<string, number> = { '<1 week': 0, '1–2 wks': 0, '2–4 wks': 0, '>1 month': 0 };
    for (const inf of infList) {
      if (!isTruthy(inf.is_profile_completed) || isTruthy(inf.is_approved_by_admin)) continue;
      const d = new Date(inf.created_date ?? inf.created_at ?? '');
      if (isNaN(d.getTime())) continue;
      const days = (now - d.getTime()) / 86400000;
      if      (days < 7)  agingMap['<1 week']++;
      else if (days < 14) agingMap['1–2 wks']++;
      else if (days < 28) agingMap['2–4 wks']++;
      else                agingMap['>1 month']++;
    }
    const aging = Object.entries(agingMap).map(([name, count]) => ({ name, count }));
    return { monthly, approved, complete, pending, funnel, aging };
  }, [infList]);

  // ── Brands ────────────────────────────────────────────────────────────────────

  const brandsMetrics = useMemo(() => {
    const active    = brandList.filter(b => isTruthy(b.is_active)).length;
    const complete  = brandList.filter(b => isTruthy(b.is_profile_completed)).length;
    const countries = topN(brandList.map(b => b.country), 8);
    const monthly   = countByMonth(brandList, 'created_date', 'created_at');
    return { active, complete, countries, monthly };
  }, [brandList]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ minHeight: '100%', background: '#1a1d2e', margin: '-24px', padding: '24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center',
            justifyContent: 'space-between', gap: 10,
            paddingBottom: 20, marginBottom: 24,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(255,255,255,0.90)', margin: '0 0 2px' }}>
                Insights
              </h1>
              {lastUpdated && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', margin: 0 }}>
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <button
              onClick={fetchAll}
              disabled={loading}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = 'rgba(79,70,229,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(79,70,229,0.15)')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(79,70,229,0.15)', border: '1px solid rgba(79,70,229,0.35)',
                color: '#818cf8', fontSize: 12, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'background 0.15s ease',
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {/* ── Error state ── */}
          {error && (
            <div style={{
              padding: '16px 20px', marginBottom: 24,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <svg width="18" height="18" fill="none" stroke="#f87171" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.9)', margin: 0, flex: 1 }}>
                Failed to load analytics data.
              </p>
              <button
                onClick={fetchAll}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.30)',
                  color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* ── Tab panel ── */}
          <div style={{
            background: '#242736',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            {/* Tab bar */}
            <div className="ins-tabs" style={{ padding: '0 8px' }}>
              {TABS.map((t, i) => (
                <button
                  key={t}
                  className={`ins-tab${tab === i ? ' active' : ''}`}
                  onClick={() => setTab(i)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div style={{ padding: '20px 16px' }}>
              {loading ? (
                <>
                  <SkeletonGrid cols={3} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <SkeletonChart />
                    <SkeletonChart />
                  </div>
                </>

              ) : tab === 0 ? (
                // ── Demographics ──────────────────────────────────────────────
                <>
                  <div className="ins-stat-grid-4">
                    <InsightStatCard label="Total Creators" value={infList.length.toLocaleString()} accent="#4f46e5" />
                    <InsightStatCard
                      label="Profile Completion Rate"
                      value={`${demographics.completionRate}%`}
                      accent="#10b981"
                      sub={`${demographics.complete} of ${infList.length} completed`}
                    />
                    <InsightStatCard
                      label="Profile Dropout Rate"
                      value={`${demographics.dropoutRate}%`}
                      accent="#f59e0b"
                      sub={`${demographics.dropout} creators stuck`}
                    />
                    <InsightStatCard
                      label="Avg. Days to Complete"
                      value="N/A"
                      accent="#7c6edd"
                      sub="(est.) — requires backend data"
                    />
                  </div>

                  <div className="ins-chart-row">
                    <ChartCard title="Top Countries">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={demographics.countries} layout="vertical"
                          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid horizontal={false} stroke={gridStroke} />
                          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 10 }}
                            axisLine={false} tickLine={false} width={72} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Creators" radius={[0, 4, 4, 0]}>
                            {demographics.countries.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Gender Distribution">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={demographics.genders} dataKey="count" nameKey="name"
                            cx="50%" cy="50%" outerRadius={88}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {demographics.genders.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<DarkTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <div className="ins-chart-row">
                    <ChartCard title="Top Cities">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={demographics.cities} layout="vertical"
                          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid horizontal={false} stroke={gridStroke} />
                          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 10 }}
                            axisLine={false} tickLine={false} width={82} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Creators" radius={[0, 4, 4, 0]}>
                            {demographics.cities.map((_, i) => (
                              <Cell key={i} fill={PALETTE[(i + 2) % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Top Niches">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={demographics.niches} layout="vertical"
                          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid horizontal={false} stroke={gridStroke} />
                          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 10 }}
                            axisLine={false} tickLine={false} width={92} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Creators" radius={[0, 4, 4, 0]}>
                            {demographics.niches.map((_, i) => (
                              <Cell key={i} fill={PALETTE[(i + 4) % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                </>

              ) : tab === 1 ? (
                // ── Reach & Influence ─────────────────────────────────────────
                <>
                  <div className="ins-stat-grid-4">
                    <InsightStatCard
                      label="Combined Followers"
                      value={reach.combinedFollowersStr}
                      accent="#4f46e5"
                    />
                    <InsightStatCard
                      label="Est. Combined Reach"
                      value={reach.combinedReachStr}
                      accent="#10b981"
                      sub="Based on 3.2% avg engagement"
                    />
                    <InsightStatCard
                      label="Avg. Followers / Creator"
                      value={reach.avgFollowersStr}
                      accent="#7c6edd"
                      sub={`across ${infList.length} creators`}
                    />
                    <InsightStatCard
                      label="Creator Retention Rate"
                      value={`${reach.retentionRate}%`}
                      accent="#f59e0b"
                      sub={`${reach.dropoutCount} never completed profile`}
                      subColor={reach.dropoutCount / Math.max(infList.length, 1) > 0.20 ? '#f59e0b' : '#10b981'}
                    />
                  </div>

                  <div className="ins-chart-row">
                    <ChartCard title="Platform Distribution">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={reach.platforms} dataKey="count" nameKey="name"
                            cx="50%" cy="50%" outerRadius={88}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {reach.platforms.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<DarkTooltip />} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Follower Range Distribution">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={reach.followerBuckets}
                          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid vertical={false} stroke={gridStroke} />
                          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Handles" radius={[4, 4, 0, 0]}>
                            {reach.followerBuckets.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <div className="ins-chart-row-1">
                    <ChartCard title="Handles by Platform" minH={240}>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={reach.platformBar}
                          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid vertical={false} stroke={gridStroke} />
                          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Handles" radius={[4, 4, 0, 0]}>
                            {reach.platformBar.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                </>

              ) : tab === 2 ? (
                // ── Growth & Health ───────────────────────────────────────────
                <>
                  <div className="ins-stat-grid-4">
                    <InsightStatCard label="Total Creators" value={infList.length.toLocaleString()} accent="#4f46e5" />
                    <InsightStatCard
                      label="Profile Complete" value={growth.complete.toLocaleString()} accent="#10b981"
                      sub={`${infList.length ? Math.round(growth.complete / infList.length * 100) : 0}% of total`}
                    />
                    <InsightStatCard
                      label="Admin Approved" value={growth.approved.toLocaleString()} accent="#7c6edd"
                      sub={`${infList.length ? Math.round(growth.approved / infList.length * 100) : 0}% of total`}
                    />
                    <InsightStatCard label="Pending Review" value={growth.pending.toLocaleString()} accent="#f59e0b" />
                  </div>

                  <div className="ins-chart-row-1">
                    <ChartCard title="Monthly Creator Signups — Last 12 Months" minH={220}>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={growth.monthly}
                          margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                          <CartesianGrid stroke={gridStroke} />
                          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<DarkTooltip />} />
                          <Line
                            type="monotone" dataKey="count" name="Signups"
                            stroke="#4f46e5" strokeWidth={2}
                            dot={{ fill: '#4f46e5', r: 3 }} activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <div className="ins-chart-row">
                    <ChartCard title="Approval Funnel">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={growth.funnel}
                          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid vertical={false} stroke={gridStroke} />
                          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Creators" radius={[4, 4, 0, 0]}>
                            {growth.funnel.map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Pending Review — Aging">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={growth.aging}
                          margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid vertical={false} stroke={gridStroke} />
                          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Pending" radius={[4, 4, 0, 0]}>
                            {growth.aging.map((_, i) => (
                              <Cell key={i} fill={['#10b981', '#f59e0b', '#f97316', '#ef4444'][i % 4]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                </>

              ) : (
                // ── Brands ────────────────────────────────────────────────────
                <>
                  <div className="ins-stat-grid">
                    <InsightStatCard label="Total Brands" value={brandList.length.toLocaleString()} accent="#f43f5e" />
                    <InsightStatCard label="Active Brands" value={brandsMetrics.active.toLocaleString()} accent="#10b981" />
                    <InsightStatCard
                      label="Profile Complete" value={brandsMetrics.complete.toLocaleString()} accent="#f59e0b"
                      sub={`${brandList.length ? Math.round(brandsMetrics.complete / brandList.length * 100) : 0}% of total`}
                    />
                  </div>

                  <div className="ins-chart-row-1">
                    <ChartCard title="Monthly Brand Signups — Last 12 Months" minH={220}>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={brandsMetrics.monthly}
                          margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                          <CartesianGrid stroke={gridStroke} />
                          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<DarkTooltip />} />
                          <Line
                            type="monotone" dataKey="count" name="Signups"
                            stroke="#f43f5e" strokeWidth={2}
                            dot={{ fill: '#f43f5e', r: 3 }} activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>

                  <div className="ins-chart-row">
                    <ChartCard title="Top Brand Countries">
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={brandsMetrics.countries} layout="vertical"
                          margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid horizontal={false} stroke={gridStroke} />
                          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} />
                          <YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 10 }}
                            axisLine={false} tickLine={false} width={82} />
                          <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Bar dataKey="count" name="Brands" radius={[0, 4, 4, 0]}>
                            {brandsMetrics.countries.map((_, i) => (
                              <Cell key={i} fill={PALETTE[(i + 3) % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 10,
                        padding: 16,
                      }}>
                        <p style={{
                          fontSize: 11, fontWeight: 600,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.35)',
                          margin: '0 0 12px',
                        }}>
                          Health Summary
                        </p>
                        {[
                          { label: 'Active',           value: brandsMetrics.active,                        color: '#10b981' },
                          { label: 'Profile Complete', value: brandsMetrics.complete,                      color: '#f59e0b' },
                          { label: 'Inactive',         value: brandList.length - brandsMetrics.active,     color: '#6b7280' },
                          { label: 'Incomplete',       value: brandList.length - brandsMetrics.complete,   color: '#ef4444' },
                        ].map((row, idx, arr) => (
                          <div key={row.label} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '9px 0',
                            borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                          }}>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{row.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: row.color }}>{row.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default Insights;
