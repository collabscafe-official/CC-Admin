// AdminOrders — paginated list of every order across all brands.
//
// Data: POST /admin/orders/list (Backend-V2). Filter by brand or fulfillment_
// status via body, paginate via ?page=&limit=. Response is enriched with
// creator avatars (first 3) + total counts + dispute count for the row badge.
//
// Row → AdminOrderDetail on click. No write actions here.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import collabs from '../config/collabs';

// ── Types ────────────────────────────────────────────────────────────────────

interface Creator {
  _id: string;
  name?: string;
  username?: string;
  profile_image?: string;
}

interface BrandSummary {
  _id: string;
  brand_name?: string;
  profile_image?: string;
}

interface OrderRow {
  _id: string;
  brand: BrandSummary | null;
  created_date?: string;
  total?: { amount?: number; currency?: string };
  fulfillment_status: string;
  items_count: number;
  creators_count: number;
  creators: Creator[];
  disputes_count: number;
  disputes_open: number;
}

// ── Status pill mapping (matches CC-Public/CC-Creator orderStatus.js) ────────

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  // Canonical lifecycle
  payment_confirmed:  { label: 'New Order',          bg: 'bg-blue-500/15',   text: 'text-blue-300' },
  brief_sent:         { label: 'Brief Sent',         bg: 'bg-blue-500/15',   text: 'text-blue-300' },
  in_progress:        { label: 'In Progress',        bg: 'bg-blue-500/15',   text: 'text-blue-300' },
  submitted:          { label: 'Review Pending',     bg: 'bg-amber-500/15',  text: 'text-amber-300' },
  revision_requested: { label: 'Revision Requested', bg: 'bg-orange-500/15', text: 'text-orange-300' },
  approved:           { label: 'Approved',           bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  completed:          { label: 'Completed',          bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  cancelled:          { label: 'Cancelled',          bg: 'bg-gray-500/15',   text: 'text-gray-300' },
  disputed:           { label: 'Disputed',           bg: 'bg-red-500/15',    text: 'text-red-300' },
  // Legacy
  Unfulfilled:           { label: 'Unfulfilled',         bg: 'bg-gray-500/15',   text: 'text-gray-300' },
  'Partially Fulfilled': { label: 'Partially Fulfilled', bg: 'bg-amber-500/15',  text: 'text-amber-300' },
  Fulfilled:             { label: 'Fulfilled',           bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
};

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '',                     label: 'All' },
  { key: 'payment_confirmed',    label: 'New' },
  { key: 'in_progress',          label: 'In Progress' },
  { key: 'submitted',            label: 'Review Pending' },
  { key: 'revision_requested',   label: 'Revision' },
  { key: 'completed',            label: 'Completed' },
  { key: 'cancelled',            label: 'Cancelled' },
  { key: 'disputed',             label: 'Disputed' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id?: string) {
  if (!id) return '—';
  return '#' + String(id).slice(-8).toUpperCase();
}

function formatDate(s?: string) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function formatAmount(n?: number, currency?: string) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: currency || 'PKR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch { return `Rs ${n.toLocaleString()}`; }
}

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

const AVATAR_COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

// ── Component ────────────────────────────────────────────────────────────────

const AdminOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const LIMIT = 25;

  useEffect(() => {
    let cancelled = false;
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, any> = {};
        if (statusFilter) body.fulfillment_status = statusFilter;
        const res = await collabs.post('/admin/orders/list', body, {
          params: { page, limit: LIMIT },
        });
        if (cancelled) return;
        if (res?.data?.success && res?.data?.data) {
          setOrders(res.data.data.orders || []);
          setTotalCount(res.data.data.pagination?.total_count || 0);
        } else {
          setOrders([]);
          setTotalCount(0);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setOrders([]);
          setTotalCount(0);
        } else {
          setError('Failed to load orders.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOrders();
    return () => { cancelled = true; };
  }, [page, statusFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / LIMIT)), [totalCount]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-gray-400 mt-1">
            All collab orders across every brand. Click a row to inspect the workspace.
          </p>
        </div>
        <div className="text-sm text-gray-400">
          {loading ? '…' : `${totalCount.toLocaleString()} total`}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(f => {
          const isActive = statusFilter === f.key;
          return (
            <button
              key={f.key || 'all'}
              onClick={() => { setStatusFilter(f.key); setPage(1); }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                isActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-dark-800 text-gray-400 border-dark-700 hover:border-primary hover:text-primary'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-3 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setPage(p => p)}
            className="text-xs font-semibold border border-red-500/40 rounded px-2.5 py-1 hover:bg-red-500/15"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="hidden md:grid grid-cols-[120px_1fr_180px_120px_140px_120px_60px] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-dark-700">
          <span>Order</span>
          <span>Brand</span>
          <span>Creators</span>
          <span>Items</span>
          <span>Total</span>
          <span>Status</span>
          <span className="text-right">⚠</span>
        </div>

        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-5 py-4 border-t border-dark-700">
            <div className="h-4 w-32 bg-dark-700 animate-pulse rounded" />
          </div>
        ))}

        {!loading && orders.length === 0 && !error && (
          <div className="px-5 py-16 text-center text-gray-500 text-sm">
            No orders match this filter.
          </div>
        )}

        {!loading && orders.map(o => {
          const status = STATUS_STYLES[o.fulfillment_status] || { label: o.fulfillment_status, bg: 'bg-gray-500/15', text: 'text-gray-300' };
          return (
            <div
              key={o._id}
              role="button"
              onClick={() => navigate(`/orders/${o._id}`)}
              className="md:grid md:grid-cols-[120px_1fr_180px_120px_140px_120px_60px] gap-3 px-5 py-4 border-t border-dark-700 cursor-pointer hover:bg-dark-700/40 transition-colors text-sm"
            >
              {/* Order ref + date */}
              <div className="flex flex-col">
                <span className="font-mono font-bold text-white tracking-wide">{shortId(o._id)}</span>
                <span className="text-[11px] text-gray-500 mt-0.5">{formatDate(o.created_date)}</span>
              </div>

              {/* Brand */}
              <div className="flex items-center gap-2.5 min-w-0">
                {o.brand?.profile_image ? (
                  <img src={o.brand.profile_image} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: AVATAR_COLORS[(o.brand?.brand_name || '').charCodeAt(0) % AVATAR_COLORS.length] }}
                  >
                    {getInitials(o.brand?.brand_name || '?')}
                  </div>
                )}
                <span className="text-gray-200 font-semibold truncate">
                  {o.brand?.brand_name || 'Unknown'}
                </span>
              </div>

              {/* Creators (avatar stack) */}
              <div className="flex items-center -space-x-2 mt-2 md:mt-0">
                {(o.creators || []).slice(0, 3).map((c, idx) => (
                  c?.profile_image ? (
                    <img
                      key={c._id || idx}
                      src={c.profile_image}
                      alt=""
                      title={c.name || c.username || ''}
                      className="w-7 h-7 rounded-full object-cover border-2 border-dark-800"
                    />
                  ) : (
                    <div
                      key={c?._id || idx}
                      title={c?.name || c?.username || ''}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-dark-800"
                      style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                    >
                      {getInitials(c?.name || c?.username || '?')}
                    </div>
                  )
                ))}
                {o.creators_count > 3 && (
                  <div className="w-7 h-7 rounded-full bg-dark-700 border-2 border-dark-800 flex items-center justify-center text-[10px] font-bold text-gray-300">
                    +{o.creators_count - 3}
                  </div>
                )}
                {o.creators_count === 0 && <span className="text-xs text-gray-500">—</span>}
              </div>

              {/* Items count */}
              <div className="text-gray-300 mt-2 md:mt-0">{o.items_count}</div>

              {/* Total */}
              <div className="font-mono font-bold text-white mt-2 md:mt-0">
                {formatAmount(o.total?.amount, o.total?.currency)}
              </div>

              {/* Status */}
              <div className="mt-2 md:mt-0">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${status.bg} ${status.text}`}>
                  {status.label}
                </span>
              </div>

              {/* Disputes badge */}
              <div className="mt-2 md:mt-0 text-right">
                {o.disputes_open > 0 ? (
                  <span title={`${o.disputes_open} open dispute(s)`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 text-[11px] font-bold">
                    ⚠ {o.disputes_open}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-500">
            Page {page} of {totalPages}
          </div>
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

export default AdminOrders;
