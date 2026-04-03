import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EMAIL_CONFIG from '../config/emailService';

const EMAIL_SERVICE_URL = EMAIL_CONFIG.BASE_URL;
const EMAIL_API_KEY = EMAIL_CONFIG.API_KEY;

// ── Types ─────────────────────────────────────────────────────────────────────
interface CsvCampaign {
  _id: string;
  name: string;
  subject: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  totalTargeted: number;
  sentCount: number;
  failedCount: number;
  ratePerHour: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;
}

interface Recipient {
  _id: string;
  name: string;
  email: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sentAt?: string;
  errorMessage?: string;
  messageId?: string;
}

// ── Status meta ───────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: '#6b7280' },
  running:   { label: 'Running',   color: '#10b981' },
  paused:    { label: 'Paused',    color: '#f59e0b' },
  completed: { label: 'Completed', color: '#3b82f6' },
  failed:    { label: 'Failed',    color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

const RECIP_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: '#6b7280' },
  sent:      { label: 'Sent',      color: '#10b981' },
  failed:    { label: 'Failed',    color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#9ca3af' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function apiHeaders() {
  return { 'x-api-key': EMAIL_API_KEY };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes cd-spin  { to { transform: rotate(360deg); } }
  @keyframes cd-pulse { 0%,100%{ opacity:1; } 50%{ opacity:0.35; } }
  @keyframes cd-toast { from { transform:translateY(12px); opacity:0; } to { transform:translateY(0); opacity:1; } }

  .cd-card {
    background:#111827;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:12px; padding:20px; margin-bottom:16px;
  }

  .cd-stat-grid {
    display:grid; grid-template-columns:repeat(2,1fr); gap:12px;
  }
  @media(min-width:640px){ .cd-stat-grid{ grid-template-columns:repeat(4,1fr); } }

  .cd-stat {
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:10px; padding:14px 16px;
  }

  .cd-btn {
    border:none; border-radius:8px;
    padding:8px 16px; font-size:13px; font-weight:500;
    cursor:pointer; transition:opacity 0.15s ease;
    display:inline-flex; align-items:center; gap:6px;
  }
  .cd-btn:disabled { opacity:0.38; cursor:not-allowed; }
  .cd-btn-amber  { background:#f59e0b; color:white; }
  .cd-btn-green  { background:#10b981; color:white; }
  .cd-btn-red    { background:#ef4444; color:white; }
  .cd-btn-gray   { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); }
  .cd-btn-blue   { background:#3b82f6; color:white; }
  .cd-btn:hover:not(:disabled) { opacity:0.82; }

  .cd-spinner {
    width:14px; height:14px;
    border:2px solid rgba(255,255,255,0.2);
    border-top-color:white; border-radius:50%;
    animation:cd-spin 0.7s linear infinite;
    display:inline-block; flex-shrink:0;
  }

  .cd-dot-pulse {
    width:7px; height:7px; border-radius:50%;
    animation:cd-pulse 1.4s ease-in-out infinite; flex-shrink:0;
  }

  .cd-progress-bar {
    width:100%; height:8px;
    background:rgba(255,255,255,0.08);
    border-radius:4px; overflow:hidden;
  }
  .cd-progress-fill {
    height:100%;
    background:linear-gradient(to right,#4f46e5,#10b981);
    border-radius:4px; transition:width 0.5s ease;
  }

  .cd-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:4px 10px; border-radius:20px; font-size:12px; font-weight:600;
  }

  .cd-table { width:100%; border-collapse:collapse; }
  .cd-table th {
    padding:9px 12px; font-size:11px; font-weight:600;
    color:rgba(255,255,255,0.35); text-align:left;
    border-bottom:1px solid rgba(255,255,255,0.07);
    white-space:nowrap;
  }
  .cd-table td {
    padding:10px 12px; font-size:13px;
    border-bottom:1px solid rgba(255,255,255,0.04);
    color:rgba(255,255,255,0.75); vertical-align:middle;
    word-break:break-word;
  }
  .cd-table tr:last-child td { border-bottom:none; }
  .cd-table tr:hover td { background:rgba(255,255,255,0.02); }

  .cd-pager {
    padding:12px 0 0; display:flex; align-items:center;
    justify-content:center; gap:12px; font-size:12px;
    color:rgba(255,255,255,0.45);
  }

  .cd-filter-tab {
    background:none; border:none; cursor:pointer;
    font-size:12px; font-weight:500; padding:5px 12px;
    border-radius:6px; transition:all 0.15s;
    color:rgba(255,255,255,0.4);
  }
  .cd-filter-tab.active {
    background:rgba(255,255,255,0.1);
    color:rgba(255,255,255,0.9);
  }
  .cd-filter-tab:hover:not(.active) { color:rgba(255,255,255,0.7); }

  .cd-toast {
    position:fixed; bottom:24px; right:24px; z-index:10000;
    padding:12px 20px; border-radius:8px;
    font-size:13px; font-weight:500;
    animation:cd-toast 0.22s ease;
    box-shadow:0 4px 20px rgba(0,0,0,0.4); max-width:320px;
  }

  .cd-section-label {
    font-size:11px; font-weight:700; color:rgba(255,255,255,0.35);
    text-transform:uppercase; letter-spacing:0.07em; margin:0 0 14px;
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function CsvEmailCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign]       = useState<CsvCampaign | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Recipients
  const [recipients, setRecipients]   = useState<Recipient[]>([]);
  const [recipLoading, setRecipLoading] = useState(false);
  const [recipTotal, setRecipTotal]   = useState(0);
  const [recipPage, setRecipPage]     = useState(1);
  const [recipTotalPages, setRecipTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // ── Toast ───────────────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load campaign ───────────────────────────────────────────────────────────
  const loadCampaign = useCallback(async () => {
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns/${id}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setCampaign(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Load recipients ─────────────────────────────────────────────────────────
  const loadRecipients = useCallback(async (page: number, status: string) => {
    setRecipLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status) params.set('status', status);
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns/${id}/recipients?${params}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setRecipients(data.recipients || []);
      setRecipTotal(data.total || 0);
      setRecipTotalPages(data.totalPages || 1);
    } catch {
      // silent
    } finally {
      setRecipLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCampaign();
    loadRecipients(1, '');
  }, [loadCampaign, loadRecipients]);

  // ── Auto-poll when running ──────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(pollRef.current);
    if (campaign?.status === 'running') {
      pollRef.current = setInterval(() => {
        loadCampaign();
        loadRecipients(recipPage, statusFilter);
      }, 10_000);
    }
    return () => clearInterval(pollRef.current);
  }, [campaign?.status, loadCampaign, loadRecipients, recipPage, statusFilter]);

  // ── Filter / page change ────────────────────────────────────────────────────
  const handleFilterChange = (s: string) => {
    setStatusFilter(s);
    setRecipPage(1);
    loadRecipients(1, s);
  };

  const handlePageChange = (p: number) => {
    setRecipPage(p);
    loadRecipients(p, statusFilter);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const doAction = async (action: 'pause' | 'resume' | 'stop' | 'send') => {
    setActionLoading(true);
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns/${id}/${action}`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || `Failed to ${action}`, false);
        return;
      }
      showToast(data.message || `Campaign ${action}d`);
      await loadCampaign();
      loadRecipients(recipPage, statusFilter);
    } catch {
      showToast('Network error', false);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
        <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white', borderRadius: '50%', animation: 'cd-spin 0.7s linear infinite' }} />
        Loading campaign...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ padding: 40, color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
        Campaign not found. <button onClick={() => navigate('/csv-campaigns')} style={{ color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>Go back</button>
      </div>
    );
  }

  const meta = STATUS_META[campaign.status] || STATUS_META.draft;
  const total = campaign.totalTargeted || 0;
  const done  = (campaign.sentCount || 0) + (campaign.failedCount || 0);
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const pending = Math.max(0, total - done);

  return (
    <>
      <style>{STYLES}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="cd-btn cd-btn-gray" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => navigate('/csv-campaigns')}>
            ← Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>{campaign.name}</h1>
              <span className="cd-badge" style={{ background: `${meta.color}22`, color: meta.color }}>
                {campaign.status === 'running' && <div className="cd-dot-pulse" style={{ background: meta.color }} />}
                {meta.label}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {campaign.subject} · Created {fmtDate(campaign.createdAt)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {campaign.status === 'draft' && (
            <button className="cd-btn cd-btn-green" disabled={actionLoading} onClick={() => doAction('send')}>
              {actionLoading ? <><div className="cd-spinner" />Starting...</> : 'Send Campaign'}
            </button>
          )}
          {campaign.status === 'running' && (
            <button className="cd-btn cd-btn-amber" disabled={actionLoading} onClick={() => doAction('pause')}>
              {actionLoading ? <><div className="cd-spinner" />Pausing...</> : 'Pause'}
            </button>
          )}
          {campaign.status === 'paused' && (
            <button className="cd-btn cd-btn-green" disabled={actionLoading} onClick={() => doAction('resume')}>
              {actionLoading ? <><div className="cd-spinner" />Resuming...</> : 'Resume'}
            </button>
          )}
          {['running', 'paused'].includes(campaign.status) && (
            <button className="cd-btn cd-btn-red" disabled={actionLoading} onClick={() => {
              if (window.confirm('Stop this campaign? Pending emails will be cancelled.')) doAction('stop');
            }}>
              Stop
            </button>
          )}
          {campaign.status === 'running' && (
            <button className="cd-btn cd-btn-gray" style={{ padding: '8px 10px' }} disabled={actionLoading} onClick={() => { loadCampaign(); loadRecipients(recipPage, statusFilter); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="cd-card">
        <p className="cd-section-label">Progress</p>

        <div className="cd-progress-bar" style={{ marginBottom: 12 }}>
          <div className="cd-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
          <span>{pct}% complete</span>
          <span>{done} / {total} processed</span>
        </div>

        <div className="cd-stat-grid">
          <div className="cd-stat">
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{total}</div>
          </div>
          <div className="cd-stat">
            <div style={{ fontSize: 11, color: '#10b981', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sent</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{campaign.sentCount}</div>
          </div>
          <div className="cd-stat">
            <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Failed</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>{campaign.failedCount}</div>
          </div>
          <div className="cd-stat">
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>{pending}</div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 20, fontSize: 12, color: 'rgba(255,255,255,0.4)', flexWrap: 'wrap' }}>
          <span>Rate: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{campaign.ratePerHour} emails/hour</strong></span>
          {campaign.startedAt && <span>Started: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{fmtDate(campaign.startedAt)}</strong></span>}
          {campaign.completedAt && <span>Completed: <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{fmtDate(campaign.completedAt)}</strong></span>}
          {campaign.pausedAt && campaign.status === 'paused' && <span>Paused: <strong style={{ color: '#f59e0b' }}>{fmtDate(campaign.pausedAt)}</strong></span>}
        </div>
      </div>

      {/* Recipients log */}
      <div className="cd-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <p className="cd-section-label" style={{ margin: 0 }}>
            Recipients Log {recipTotal > 0 && <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>({recipTotal})</span>}
          </p>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 3 }}>
            {['', 'pending', 'sent', 'failed', 'cancelled'].map((s) => (
              <button
                key={s}
                className={`cd-filter-tab${statusFilter === s ? ' active' : ''}`}
                onClick={() => handleFilterChange(s)}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {recipLoading && recipients.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            <div className="cd-spinner" /> Loading recipients...
          </div>
        ) : recipients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            No recipients {statusFilter ? `with status "${statusFilter}"` : ''} found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="cd-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Sent At</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r, i) => {
                  const rMeta = RECIP_STATUS_META[r.status] || RECIP_STATUS_META.pending;
                  return (
                    <tr key={r._id}>
                      <td style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                        {(recipPage - 1) * 50 + i + 1}
                      </td>
                      <td>{r.name || <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>}</td>
                      <td style={{ color: 'rgba(255,255,255,0.6)' }}>{r.email}</td>
                      <td>
                        <span className="cd-badge" style={{ background: `${rMeta.color}22`, color: rMeta.color, padding: '2px 8px', fontSize: 11 }}>
                          {rMeta.label}
                        </span>
                      </td>
                      <td style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                        {r.sentAt ? fmtDate(r.sentAt) : '—'}
                      </td>
                      <td style={{ color: '#ef4444', fontSize: 12, maxWidth: 200 }}>
                        {r.errorMessage || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {recipTotalPages > 1 && (
              <div className="cd-pager">
                <button className="cd-btn cd-btn-gray" style={{ padding: '4px 12px', fontSize: 12 }} disabled={recipPage === 1 || recipLoading} onClick={() => handlePageChange(recipPage - 1)}>
                  ‹ Prev
                </button>
                <span>Page {recipPage} of {recipTotalPages}</span>
                <button className="cd-btn cd-btn-gray" style={{ padding: '4px 12px', fontSize: 12 }} disabled={recipPage === recipTotalPages || recipLoading} onClick={() => handlePageChange(recipPage + 1)}>
                  Next ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="cd-toast" style={{ background: toast.ok ? '#10b981' : '#ef4444', color: 'white' }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
