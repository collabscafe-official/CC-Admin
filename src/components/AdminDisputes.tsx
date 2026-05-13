// AdminDisputes — list of every "Report a problem" submission across orders.
//
// Data: POST /admin/disputes/list (Backend-V2). Filter by status via body,
// paginate via ?page=&limit=. Each row links to the dispute's parent order
// in AdminOrderDetail with the disputes panel scrolled into view.
//
// Status update + admin_note live inside AdminOrderDetail's dispute panel —
// not duplicated here.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import collabs from '../config/collabs';

// ── Types ────────────────────────────────────────────────────────────────────

interface DisputeRow {
  _id: string;
  order: string;
  opened_by: { user_id: string; type: 'brand' | 'influencer'; name?: string };
  message: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  admin_note?: string;
  created_at?: string;
  order_summary?: {
    _id: string;
    brand?: { _id: string; brand_name?: string; profile_image?: string };
    total?: { amount?: number; currency?: string };
    fulfillment_status?: string;
    created_date?: string;
  };
}

// ── Status pill mapping ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  open:      { label: 'Open',      bg: 'bg-red-500/15',     text: 'text-red-300' },
  reviewing: { label: 'Reviewing', bg: 'bg-amber-500/15',   text: 'text-amber-300' },
  resolved:  { label: 'Resolved',  bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  dismissed: { label: 'Dismissed', bg: 'bg-gray-500/15',    text: 'text-gray-300' },
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '',          label: 'All' },
  { key: 'open',      label: 'Open' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'resolved',  label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id?: string) {
  if (!id) return '—';
  return '#' + String(id).slice(-8).toUpperCase();
}

function formatDateTime(s?: string) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

// ── Component ────────────────────────────────────────────────────────────────

const AdminDisputes: React.FC = () => {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('open');
  const LIMIT = 25;

  useEffect(() => {
    let cancelled = false;
    const fetchDisputes = async () => {
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, any> = {};
        if (statusFilter) body.status = statusFilter;
        const res = await collabs.post('/admin/disputes/list', body, {
          params: { page, limit: LIMIT },
        });
        if (cancelled) return;
        if (res?.data?.success && res?.data?.data) {
          setDisputes(res.data.data.disputes || []);
          setTotalCount(res.data.data.pagination?.total_count || 0);
        } else {
          setDisputes([]);
          setTotalCount(0);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setDisputes([]);
          setTotalCount(0);
        } else {
          setError('Failed to load disputes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDisputes();
    return () => { cancelled = true; };
  }, [page, statusFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / LIMIT)), [totalCount]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Disputes</h1>
          <p className="text-sm text-gray-400 mt-1">
            "Report a problem" submissions from brands and creators inside the workspace.
          </p>
        </div>
        <div className="text-sm text-gray-400">
          {loading ? '…' : `${totalCount.toLocaleString()} ${statusFilter || 'total'}`}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(t => {
          const isActive = statusFilter === t.key;
          return (
            <button
              key={t.key || 'all'}
              onClick={() => { setStatusFilter(t.key); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                isActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-dark-800 text-gray-400 border-dark-700 hover:border-primary hover:text-primary'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Disputes list */}
      <div className="space-y-3">
        {loading && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-dark-800 rounded-xl border border-dark-700 px-5 py-4">
            <div className="h-4 w-40 bg-dark-700 animate-pulse rounded mb-3" />
            <div className="h-3 w-full bg-dark-700 animate-pulse rounded" />
          </div>
        ))}

        {!loading && disputes.length === 0 && !error && (
          <div className="bg-dark-800 rounded-xl border border-dark-700 px-5 py-12 text-center text-gray-500 text-sm">
            No {statusFilter || 'open'} disputes.
          </div>
        )}

        {!loading && disputes.map(d => {
          const status = STATUS_STYLES[d.status] || { label: d.status, bg: 'bg-gray-500/15', text: 'text-gray-300' };
          const reporterType = d.opened_by?.type === 'brand' ? 'Brand' : 'Creator';
          return (
            <div
              key={d._id}
              role="button"
              onClick={() => navigate(`/orders/${d.order}?dispute=${d._id}`)}
              className="bg-dark-800 rounded-xl border border-dark-700 px-5 py-4 cursor-pointer hover:border-primary/40 hover:bg-dark-700/40 transition-colors"
            >
              {/* Top row */}
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-white">
                    {shortId(d.order)}
                  </span>
                  {d.order_summary?.brand?.brand_name && (
                    <>
                      <span className="text-gray-600">·</span>
                      <span className="text-sm text-gray-300 font-semibold truncate max-w-[200px]">
                        {d.order_summary.brand.brand_name}
                      </span>
                    </>
                  )}
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
                <span className="text-[11px] text-gray-500">
                  {formatDateTime(d.created_at)}
                </span>
              </div>

              {/* Reporter + message preview */}
              <div className="text-xs text-gray-400 mb-1.5">
                <span className="text-gray-500">Reported by</span>{' '}
                <span className="font-semibold text-gray-300">
                  {reporterType} · {d.opened_by?.name || 'Unknown'}
                </span>
              </div>
              <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">
                {d.message}
              </p>

              {d.admin_note && (
                <div className="mt-2.5 px-3 py-2 rounded bg-dark-900/50 border border-dark-700 text-[12px] text-gray-400 italic">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 not-italic">Admin note:</span>{' '}
                  {d.admin_note}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-500">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded bg-dark-800 border border-dark-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-700"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded bg-dark-800 border border-dark-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDisputes;
