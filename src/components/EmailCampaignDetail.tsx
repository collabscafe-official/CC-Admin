import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// ── API config (mirrors EmailCampaigns.tsx) ───────────────────────────────────
const EMAIL_SERVICE_URL = 'http://localhost:4000';
const EMAIL_API_KEY = 'cc-email-admin-2026';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Campaign {
  _id: string;
  name: string;
  templateType: string;
  subject: string;
  customBody?: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed';
  totalTargeted: number;
  sentCount: number;
  failedCount: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  targetFilters?: any;
}

interface EmailLog {
  _id: string;
  email: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  messageId?: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

// ── Config maps ───────────────────────────────────────────────────────────────
const TYPE_META: Record<string, { label: string; color: string }> = {
  'incomplete-profile': { label: 'Incomplete Profile', color: '#f59e0b' },
  'unverified-email':   { label: 'Unverified Email',   color: '#3b82f6' },
  'inactivity':         { label: 'Inactivity',         color: '#8b5cf6' },
  'custom':             { label: 'Custom',             color: '#10b981' },
};

const STATUS_META: Record<string, { label: string; color: string; pulse?: boolean }> = {
  draft:     { label: 'Draft',     color: '#6b7280' },
  running:   { label: 'Running',   color: '#3b82f6', pulse: true },
  paused:    { label: 'Paused',    color: '#f59e0b' },
  completed: { label: 'Completed', color: '#10b981' },
  failed:    { label: 'Failed',    color: '#ef4444' },
};

const LOG_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:  { label: 'Pending',  color: '#6b7280' },
  sent:     { label: 'Sent',     color: '#10b981' },
  failed:   { label: 'Failed',   color: '#ef4444' },
  bounced:  { label: 'Bounced',  color: '#f59e0b' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDateTime(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function apiHeaders(json = false) {
  const h: Record<string, string> = { 'x-api-key': EMAIL_API_KEY };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes ecd-spin  { to { transform:rotate(360deg); } }
  @keyframes ecd-pulse { 0%,100%{ opacity:1; } 50%{ opacity:0.35; } }

  .ecd-card {
    background:#111827;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:12px; padding:20px; margin-bottom:16px;
  }

  .ecd-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  @media(min-width:640px){ .ecd-stat-grid{ grid-template-columns:repeat(4,1fr); } }

  .ecd-stat-card {
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:10px; padding:14px 16px;
    text-align:center;
  }

  .ecd-info-grid { display:grid; grid-template-columns:1fr; gap:12px; }
  @media(min-width:640px){ .ecd-info-grid{ grid-template-columns:1fr 1fr; } }

  .ecd-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 9px; border-radius:20px; font-size:11px; font-weight:600;
  }

  .ecd-dot-pulse {
    width:7px; height:7px; border-radius:50%;
    animation:ecd-pulse 1.4s ease-in-out infinite; flex-shrink:0;
  }

  .ecd-progress-bar {
    width:100%; height:10px;
    background:rgba(255,255,255,0.08);
    border-radius:5px; overflow:hidden;
  }
  .ecd-progress-fill {
    height:100%;
    background:linear-gradient(to right,#4f46e5,#10b981);
    border-radius:5px; transition:width 0.5s ease;
  }

  .ecd-spinner {
    width:20px; height:20px;
    border:2px solid rgba(255,255,255,0.15);
    border-top-color:#4f46e5; border-radius:50%;
    animation:ecd-spin 0.8s linear infinite; display:block;
  }

  .ecd-tabs { display:flex; gap:0; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:16px; }
  .ecd-tab {
    background:none; border:none; border-bottom:2px solid transparent;
    padding:10px 16px; font-size:13px; font-weight:500;
    color:rgba(255,255,255,0.4); cursor:pointer;
    transition:all 0.15s ease; white-space:nowrap;
  }
  .ecd-tab.active { color:#818cf8; border-bottom-color:#4f46e5; }
  .ecd-tab:hover:not(.active) { color:rgba(255,255,255,0.7); }

  .ecd-table { width:100%; border-collapse:collapse; font-size:13px; }
  .ecd-table th {
    text-align:left; padding:10px 12px;
    font-size:11px; font-weight:600; text-transform:uppercase;
    letter-spacing:0.06em; color:rgba(255,255,255,0.35);
    border-bottom:1px solid rgba(255,255,255,0.08);
    background:rgba(255,255,255,0.02);
  }
  .ecd-table td {
    padding:10px 12px; color:rgba(255,255,255,0.72);
    border-bottom:1px solid rgba(255,255,255,0.04);
    vertical-align:middle;
  }
  .ecd-table tr:last-child td { border-bottom:none; }
  .ecd-row-failed { background:rgba(239,68,68,0.04); }

  .ecd-pagination {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 0 0; flex-wrap:wrap; gap:8px;
  }
  .ecd-page-btn {
    background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
    color:rgba(255,255,255,0.7); border-radius:6px;
    padding:6px 14px; font-size:12px; cursor:pointer;
    transition:background 0.15s ease;
  }
  .ecd-page-btn:hover:not(:disabled) { background:rgba(255,255,255,0.12); }
  .ecd-page-btn:disabled { opacity:0.35; cursor:not-allowed; }

  .ecd-back-btn {
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);
    color:rgba(255,255,255,0.7); border-radius:8px;
    padding:8px 14px; font-size:13px; cursor:pointer;
    display:inline-flex; align-items:center; gap:6px;
    transition:background 0.15s ease; margin-bottom:20px;
  }
  .ecd-back-btn:hover { background:rgba(255,255,255,0.1); color:white; }

  .ecd-code-block {
    background:#1f2937; border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:14px;
    font-family:'Courier New',monospace; font-size:12px;
    color:rgba(255,255,255,0.7); line-height:1.6;
    white-space:pre-wrap; word-break:break-word; margin:0;
  }

  .ecd-divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:16px 0; }

  .ecd-empty { text-align:center; padding:40px 20px; color:rgba(255,255,255,0.35); font-size:14px; }
`;

// ── Component ─────────────────────────────────────────────────────────────────
const LOGS_PER_PAGE = 50;
type LogTab = 'all' | 'sent' | 'failed';

export default function EmailCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [campaignLoading, setCampaignLoading] = useState(true);
  const [campaignError, setCampaignError] = useState('');

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [activeTab, setActiveTab] = useState<LogTab>('all');

  const isRunningRef = useRef(false);

  // ── Fetch campaign ───────────────────────────────────────────────────────────
  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns/${id}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCampaign(data);
      isRunningRef.current = data.status === 'running';
    } catch (e: any) {
      setCampaignError(e.message);
    } finally {
      setCampaignLoading(false);
    }
  }, [id]);

  // ── Fetch logs ───────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async (page = 1, tab: LogTab = 'all') => {
    if (!id) return;
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LOGS_PER_PAGE) });
      if (tab !== 'all') params.set('status', tab);
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns/${id}/logs?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
    } catch (_) {
      // silently keep stale data on poll failures
    } finally {
      setLogsLoading(false);
    }
  }, [id]);

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchCampaign();
    fetchLogs(1, 'all');
  }, [fetchCampaign, fetchLogs]);

  useEffect(() => {
    const pollId = setInterval(() => {
      if (isRunningRef.current) {
        fetchCampaign();
        fetchLogs(logsPage, activeTab);
      }
    }, 10000);
    return () => clearInterval(pollId);
  }, [fetchCampaign, fetchLogs, logsPage, activeTab]);

  const handleTabChange = (tab: LogTab) => {
    setActiveTab(tab);
    setLogsPage(1);
    fetchLogs(1, tab);
  };

  const handlePageChange = (p: number) => {
    setLogsPage(p);
    fetchLogs(p, activeTab);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(logsTotal / LOGS_PER_PAGE);

  const pct = campaign && campaign.totalTargeted > 0
    ? Math.min(100, (campaign.sentCount / campaign.totalTargeted) * 100)
    : 0;

  const pending = campaign
    ? Math.max(0, campaign.totalTargeted - campaign.sentCount - campaign.failedCount)
    : 0;

  const estRemaining = (() => {
    if (!campaign || campaign.status !== 'running') return null;
    const remaining = campaign.totalTargeted - campaign.sentCount;
    if (remaining <= 0) return null;
    const rate = 100; // default — stored in queue config
    const hours = remaining / rate;
    return hours >= 1
      ? `~${Math.ceil(hours)} hours remaining`
      : `~${Math.ceil(hours * 60)} minutes remaining`;
  })();

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (campaignLoading) {
    return (
      <>
        <style>{STYLES}</style>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="ecd-spinner" style={{ width: 32, height: 32 }} />
        </div>
      </>
    );
  }

  if (campaignError || !campaign) {
    return (
      <>
        <style>{STYLES}</style>
        <div style={{ color: 'white' }}>
          <button className="ecd-back-btn" onClick={() => navigate('/email-campaigns')}>← Back</button>
          <div style={{ padding: '20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#ef4444', fontSize: 14 }}>
            {campaignError || 'Campaign not found'}
          </div>
        </div>
      </>
    );
  }

  const typeMeta   = TYPE_META[campaign.templateType]   || { label: campaign.templateType, color: '#6b7280' };
  const statusMeta = STATUS_META[campaign.status] || { label: campaign.status, color: '#6b7280', pulse: false };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div style={{ color: 'white', fontFamily: 'inherit' }}>

        {/* Back */}
        <button className="ecd-back-btn" onClick={() => navigate('/email-campaigns')}>
          ← Back to Campaigns
        </button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>{campaign.name}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="ecd-badge" style={{ background: typeMeta.color + '22', color: typeMeta.color }}>{typeMeta.label}</span>
            <span className="ecd-badge" style={{ background: statusMeta.color + '22', color: statusMeta.color }}>
              {statusMeta.pulse && <span className="ecd-dot-pulse" style={{ background: statusMeta.color }} />}
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* Section 1 — Campaign Info */}
        <div className="ecd-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Campaign Info</h3>
          <div className="ecd-info-grid">
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</p>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{campaign.subject}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</p>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{typeMeta.label}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</p>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{fmtDate(campaign.createdAt)}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Started</p>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{fmtDateTime(campaign.startedAt)}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Completed</p>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{fmtDateTime(campaign.completedAt)}</p>
            </div>
          </div>

          {campaign.customBody && (
            <>
              <hr className="ecd-divider" />
              <p style={{ margin: '0 0 8px', fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email Body</p>
              <pre className="ecd-code-block">{campaign.customBody}</pre>
            </>
          )}
        </div>

        {/* Section 2 — Progress */}
        <div className="ecd-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Progress</h3>

          {/* Large progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div className="ecd-progress-bar">
              <div className="ecd-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                {campaign.sentCount.toLocaleString()} / {campaign.totalTargeted.toLocaleString()} sent
              </span>
              <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>{pct.toFixed(1)}%</span>
            </div>
          </div>

          {estRemaining && (
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#f59e0b' }}>⏱ {estRemaining}</p>
          )}

          {/* Stat cards */}
          <div className="ecd-stat-grid">
            {[
              { label: 'Total',   val: campaign.totalTargeted, color: '#818cf8' },
              { label: 'Sent',    val: campaign.sentCount,     color: '#10b981' },
              { label: 'Failed',  val: campaign.failedCount,   color: '#ef4444' },
              { label: 'Pending', val: pending,                color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} className="ecd-stat-card">
                <p style={{ margin: '0 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: s.color }}>{s.val.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3 — Email Logs */}
        <div className="ecd-card">
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email Logs</h3>

          {/* Filter tabs */}
          <div className="ecd-tabs">
            {(['all', 'sent', 'failed'] as LogTab[]).map(tab => (
              <button key={tab} className={`ecd-tab${activeTab === tab ? ' active' : ''}`} onClick={() => handleTabChange(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Table */}
          {logsLoading && logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <div className="ecd-spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : logs.length === 0 ? (
            <div className="ecd-empty">No logs for this filter</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ecd-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Sent At</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const lm = LOG_STATUS_META[log.status] || { label: log.status, color: '#6b7280' };
                    return (
                      <tr key={log._id} className={log.status === 'failed' ? 'ecd-row-failed' : ''}>
                        <td>{log.email}</td>
                        <td>
                          <span className="ecd-badge" style={{ background: lm.color + '22', color: lm.color }}>
                            {lm.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{fmtDateTime(log.sentAt)}</td>
                        <td style={{ fontSize: 12, color: '#ef4444', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.errorMessage || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ecd-pagination">
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>
                Page {logsPage} of {totalPages} · {logsTotal.toLocaleString()} results
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ecd-page-btn" disabled={logsPage <= 1} onClick={() => handlePageChange(logsPage - 1)}>← Prev</button>
                <button className="ecd-page-btn" disabled={logsPage >= totalPages} onClick={() => handlePageChange(logsPage + 1)}>Next →</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
