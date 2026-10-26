// "What our AI knows" card on the admin brand page (2026-10-26).
// Data: POST /admin/brands/ai-insight { brand_id } -> Backend-V2 -> CC Pixels
// GET /v1/brand/insight/:id. Read-only. Shows the website + Instagram audit,
// the browsing signals the nightly job learned, and the exact text the
// brand's ranking is built from.
import React, { useEffect, useState } from 'react';
import collabs from '../config/collabs';

const STATUS: Record<string, { label: string; color: string }> = {
  ok: { label: 'Read', color: '#34d399' },
  skipped_free_email: { label: 'Skipped: Gmail-type email and no website', color: '#fbbf24' },
  fetch_failed: { label: "Couldn't read it", color: '#f87171' },
  fetch_blocked: { label: 'Site blocked us', color: '#f87171' },
  ai_failed: { label: 'AI step failed', color: '#f87171' },
  no_handle: { label: 'No Instagram added', color: '#9ca3af' },
  invalid_email: { label: 'No usable email', color: '#9ca3af' },
};

const box: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14 };
const head: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 };
const label: React.CSSProperties = { fontSize: 11, color: '#6b7280', marginBottom: 2 };
const value: React.CSSProperties = { fontSize: 13, color: '#e5e7eb', marginBottom: 8, lineHeight: 1.45 };
const chip: React.CSSProperties = { fontSize: 12, padding: '3px 8px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, color: '#d1d5db' };

const when = (d?: string | null) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never');

function Status({ s }: { s?: string | null }) {
  const st = (s && STATUS[s]) || { label: s ? s.replace(/_/g, ' ') : 'Not run yet', color: '#9ca3af' };
  return <span style={{ fontSize: 12, fontWeight: 600, color: st.color }}>{st.label}</span>;
}

function Field({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (<><div style={label}>{k}</div><div style={value}>{v}</div></>);
}

function Chips({ items, prefix = '' }: { items?: string[]; prefix?: string }) {
  if (!items || items.length === 0) return <div style={{ ...value, color: '#6b7280' }}>None yet</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {items.slice(0, 30).map((x, i) => <span key={i} style={chip}>{prefix}{String(x).replace(/^@+/, '')}</span>)}
    </div>
  );
}

export default function BrandAiInsightCard({ brandId, card, sectionTitle }: { brandId: string; card: React.CSSProperties; sectionTitle: React.CSSProperties }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!brandId) return;
    let alive = true;
    collabs.post('/admin/brands/ai-insight', { brand_id: brandId })
      .then((r) => { if (alive) setData(r?.data?.data || null); })
      .catch((e) => { if (alive) setError(e?.response?.data?.message || 'Could not load AI data.'); });
    return () => { alive = false; };
  }, [brandId]);

  const w = data?.website, ig = data?.instagram, b = data?.behavior, rt = data?.ranking_text;
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <p style={sectionTitle}>What our AI knows</p>
      {error ? <div style={{ fontSize: 13, color: '#f87171' }}>{error}</div> : !data ? <div style={{ fontSize: 13, color: '#6b7280' }}>Loading…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div style={box}>
              <div style={head}>Website audit</div>
              <div style={label}>Status</div>
              <div style={value}><Status s={w?.status} />{w?.source ? <span style={{ color: '#6b7280' }}> · {w.source}</span> : null}</div>
              <Field k="Industry" v={w?.industry} />
              <Field k="What they do" v={w?.description} />
              <Field k="Products" v={w?.products} />
              <Field k="Audience" v={w?.audience} />
              <div style={{ fontSize: 11, color: '#6b7280' }}>Checked {when(w?.checked_at)}</div>
            </div>
            <div style={box}>
              <div style={head}>Instagram audit</div>
              <div style={label}>Status</div>
              <div style={value}><Status s={ig?.status} />{ig?.handle ? <span style={{ color: '#6b7280' }}> · @{String(ig.handle).replace(/^@+/, '')}</span> : null}</div>
              <Field k="Tone" v={ig?.tone} />
              <Field k="Audience" v={ig?.audience} />
              <Field k="Content themes" v={ig?.themes} />
              <div style={{ fontSize: 11, color: '#6b7280' }}>Checked {when(ig?.checked_at)}</div>
            </div>
            <div style={box}>
              <div style={head}>Learned from browsing (last {b?.lookback_days || 30} days)</div>
              <div style={label}>Searches</div><Chips items={b?.searches} />
              <div style={label}>Niche / city filters</div><Chips items={[...(b?.niches || []), ...(b?.cities || [])]} />
              <div style={label}>Creators opened ({b?.viewed_creators?.length || 0})</div><Chips items={b?.viewed_creators} prefix="@" />
              <div style={{ fontSize: 11, color: '#6b7280' }}>{b?.events || 0} actions · updated {when(b?.computed_at)}</div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setShowText((v) => !v)} style={{ background: 'none', border: 0, padding: 0, color: '#a5b4fc', fontSize: 12, cursor: 'pointer' }}>
              {showText ? 'Hide' : 'Show'} what the ranking is built from{rt?.updated_at ? ` (updated ${when(rt.updated_at)})` : ''}
            </button>
            {showText && (
              <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12, color: '#d1d5db', background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 12 }}>
                {rt?.text || 'No ranking profile yet. It is built the first time this brand opens Explore.'}
                {b?.viewed_creators?.length ? `\n+ blended with the ${Math.min(b.viewed_creators.length, 30)} creators they opened (35% weight)` : ''}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
