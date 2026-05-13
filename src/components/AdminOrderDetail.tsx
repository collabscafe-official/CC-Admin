// AdminOrderDetail — read-only workspace view for admin.
//
// Shows: brand header, multi-creator tabs (if multi), per-creator pane with
// line items + submissions + status timeline + brief, full chat history
// embed (read-only, paginated), and a disputes panel with status update +
// admin_note write access.
//
// Data:
//   POST /admin/orders/detail { order_id }
//   POST /admin/chats/messages { chat_id, cursor?, limit? }
//   POST /admin/disputes/update { dispute_id, status?, admin_note? }
//
// Read-only on order actions. The only write action here is updating a
// dispute's status + admin_note (per Phase 3 scope).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import collabs from '../config/collabs';

// ── Types ────────────────────────────────────────────────────────────────────

interface Influencer {
  _id: string;
  name?: string;
  username?: string;
  profile_image?: string;
  email?: string;
}

interface BrandData {
  _id: string;
  brand_name?: string;
  email?: string;
  profile_image?: string;
  category?: string;
  campaign_goal?: string;
}

interface Submission {
  deliverable_url?: string;
  note?: string;
  submitted_at?: string;
  type?: 'initial' | 'revision';
  file?: { url?: string; name?: string; mime_type?: string; size?: number };
}

interface LineItem {
  _id: string;
  title?: string;
  description?: string;
  amount?: number;
  currency?: string;
  fulfillment_status: string;
  deliverable_url?: string;
  submission_date?: string;
  submissions?: Submission[];
  revision_count?: number;
  revision_note?: string;
  approved_at?: string;
  chat_id?: string;
  influencer?: Influencer;
  platform?: { label?: string; value?: string; icon?: string };
  content_deliverable?: { label?: string; value?: string; icon?: string };
}

interface Brief {
  _id: string;
  goal?: string;
  what_to_post?: string;
  talking_points?: string;
  tone?: string[];
  reference_links?: string[];
  hard_deadline?: string;
  anything_else?: string;
  voice_note?: { url?: string; duration?: number };
  sent_at?: string;
  last_edited_at?: string;
}

interface Dispute {
  _id: string;
  order: string;
  opened_by: { user_id: string; type: 'brand' | 'influencer'; name?: string };
  message: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  admin_note?: string;
  created_at?: string;
  updated_at?: string;
}

interface OrderDetail {
  _id: string;
  brand: BrandData | null;
  created_date?: string;
  total?: { amount?: number; currency?: string };
  fulfillment_status: string;
  line_items: LineItem[];
  brief?: Brief | null;
  disputes: Dispute[];
}

interface ChatMessage {
  _id: string;
  chat_id: string;
  sender?: { user_id: string; type: 'brand' | 'influencer' };
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'system' | 'brief';
  text?: string;
  media?: { url?: string; name?: string; mime_type?: string; size?: number; duration?: number };
  brief_data?: any;
  system_event?: string;
  system_metadata?: any;
  created_at?: string;
}

// ── Status pill mapping (shared with AdminOrders) ────────────────────────────

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  payment_confirmed:  { label: 'New Order',          bg: 'bg-blue-500/15',    text: 'text-blue-300' },
  brief_sent:         { label: 'Brief Sent',         bg: 'bg-blue-500/15',    text: 'text-blue-300' },
  in_progress:        { label: 'In Progress',        bg: 'bg-blue-500/15',    text: 'text-blue-300' },
  submitted:          { label: 'Review Pending',     bg: 'bg-amber-500/15',   text: 'text-amber-300' },
  revision_requested: { label: 'Revision Requested', bg: 'bg-orange-500/15',  text: 'text-orange-300' },
  approved:           { label: 'Approved',           bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  completed:          { label: 'Completed',          bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  cancelled:          { label: 'Cancelled',          bg: 'bg-gray-500/15',    text: 'text-gray-300' },
  disputed:           { label: 'Disputed',           bg: 'bg-red-500/15',     text: 'text-red-300' },
  Unfulfilled:           { label: 'Unfulfilled',         bg: 'bg-gray-500/15',    text: 'text-gray-300' },
  'Partially Fulfilled': { label: 'Partially Fulfilled', bg: 'bg-amber-500/15',   text: 'text-amber-300' },
  Fulfilled:             { label: 'Fulfilled',           bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
};

const DISPUTE_STATUSES: { key: 'open' | 'reviewing' | 'resolved' | 'dismissed'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id?: string) { return id ? '#' + String(id).slice(-8).toUpperCase() : '—'; }
function formatDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; }
}
function formatDateTime(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}
function formatAmount(n?: number, currency?: string) {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('en-PK', { style: 'currency', currency: currency || 'PKR', maximumFractionDigits: 0 }).format(n);
  } catch { return `Rs ${n.toLocaleString()}`; }
}
function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name[0].toUpperCase();
}

// ── Chat history viewer (read-only embed) ────────────────────────────────────

const ChatHistoryViewer: React.FC<{ chatId: string | null; brand?: BrandData | null; creator?: Influencer }> = ({ chatId, brand, creator }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const initialFetchKey = useRef<string | null>(null);

  // Load first page when chatId changes
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setError(null);
      return;
    }
    if (initialFetchKey.current === chatId) return;
    initialFetchKey.current = chatId;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await collabs.post('/admin/chats/messages', { chat_id: chatId, limit: 50 });
        if (cancelled) return;
        if (res?.data?.success && res?.data?.data) {
          setMessages(res.data.data.messages || []);
          setNextCursor(res.data.data.pagination?.nextCursor || null);
          setHasMore(!!res.data.data.pagination?.hasMore);
        } else {
          setMessages([]);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.message || 'Failed to load chat history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [chatId]);

  const loadOlder = useCallback(async () => {
    if (!chatId || !nextCursor || loading) return;
    setLoading(true);
    try {
      const res = await collabs.post('/admin/chats/messages', { chat_id: chatId, cursor: nextCursor, limit: 50 });
      if (res?.data?.success && res?.data?.data) {
        const older = res.data.data.messages || [];
        setMessages(prev => [...older, ...prev]);
        setNextCursor(res.data.data.pagination?.nextCursor || null);
        setHasMore(!!res.data.data.pagination?.hasMore);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load older messages.');
    } finally {
      setLoading(false);
    }
  }, [chatId, nextCursor, loading]);

  if (!chatId) {
    return (
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 text-center text-sm text-gray-500">
        No chat thread linked to this creator. Likely a pre-Workspace-v2 order.
      </div>
    );
  }

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl flex flex-col" style={{ maxHeight: 600 }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary flex-shrink-0">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="text-sm font-bold text-white truncate">Chat history</span>
          <span className="text-xs text-gray-500 truncate">
            {brand?.brand_name || 'Brand'} ↔ {creator?.name || creator?.username || 'Creator'}
          </span>
        </div>
        <span className="text-[11px] text-gray-500 font-mono">{messages.length}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {hasMore && (
          <button
            onClick={loadOlder}
            disabled={loading}
            className="w-full text-xs text-primary hover:text-primary/80 py-2 disabled:opacity-50"
          >
            {loading ? 'Loading…' : '↑ Load older messages'}
          </button>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded px-3 py-2 text-xs">
            {error}
          </div>
        )}

        {!loading && !error && messages.length === 0 && (
          <div className="text-center text-xs text-gray-500 py-8">No messages yet.</div>
        )}

        {messages.map((m, idx) => {
          // System messages — centered pill
          if (m.message_type === 'system') {
            return (
              <div key={m._id || idx} className="flex justify-center my-2">
                <div className="bg-dark-700/60 px-3 py-1 rounded-full text-[11px] text-gray-400 italic">
                  {m.text || m.system_event || 'system update'}
                  <span className="ml-2 text-gray-600">{formatDateTime(m.created_at)}</span>
                </div>
              </div>
            );
          }
          // Brief card — special highlight
          if (m.message_type === 'brief') {
            return (
              <div key={m._id || idx} className="my-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">📋 Campaign Brief</div>
                {m.brief_data?.goal && <div className="text-xs text-gray-300 mb-1"><span className="text-gray-500">Goal:</span> {m.brief_data.goal}</div>}
                {m.brief_data?.anything_else && <div className="text-xs text-gray-300 italic line-clamp-3">{m.brief_data.anything_else}</div>}
                <div className="text-[10px] text-gray-500 mt-1.5">{formatDateTime(m.created_at)}</div>
              </div>
            );
          }
          // Regular message
          const isBrand = m.sender?.type === 'brand';
          return (
            <div
              key={m._id || idx}
              className={`flex ${isBrand ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                  isBrand
                    ? 'bg-primary/15 border border-primary/30 text-gray-100 rounded-tr-sm'
                    : 'bg-dark-700 border border-dark-600 text-gray-200 rounded-tl-sm'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-60">
                  {isBrand ? brand?.brand_name || 'Brand' : creator?.name || creator?.username || 'Creator'}
                </div>
                {m.text && <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>}
                {m.media?.url && (
                  <div className="mt-1.5 text-xs">
                    <a href={m.media.url} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline break-all">
                      📎 {m.media.name || m.message_type} {m.media.size ? `(${Math.round(m.media.size / 1024)} KB)` : ''}
                    </a>
                  </div>
                )}
                <div className="text-[10px] text-gray-500 mt-1">{formatDateTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}

        {loading && messages.length === 0 && (
          <div className="text-center text-xs text-gray-500 py-8">Loading…</div>
        )}
      </div>
    </div>
  );
};

// ── Dispute panel with inline update ─────────────────────────────────────────

const DisputeCard: React.FC<{ dispute: Dispute; highlight?: boolean; onUpdated: (d: Dispute) => void }> = ({ dispute, highlight, onUpdated }) => {
  const [status, setStatus] = useState(dispute.status);
  const [adminNote, setAdminNote] = useState(dispute.admin_note || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = status !== dispute.status || adminNote !== (dispute.admin_note || '');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await collabs.post('/admin/disputes/update', {
        dispute_id: dispute._id,
        status,
        admin_note: adminNote,
      });
      if (res?.data?.success && res?.data?.data) {
        onUpdated(res.data.data);
        setSavedAt(Date.now());
      } else {
        setError(res?.data?.message || 'Save failed');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const reporterType = dispute.opened_by?.type === 'brand' ? 'Brand' : 'Creator';

  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-amber-500/60 bg-amber-500/5' : 'border-dark-700 bg-dark-900/40'}`}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Reported by</span>
          <span className="font-semibold text-gray-200">
            {reporterType} · {dispute.opened_by?.name || 'Unknown'}
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-500">{formatDateTime(dispute.created_at)}</span>
        </div>
      </div>

      <p className="text-sm text-gray-200 mb-3 whitespace-pre-wrap">{dispute.message}</p>

      {/* Update form */}
      <div className="space-y-3 mt-4 pt-4 border-t border-dark-700">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">Status</label>
          <div className="flex flex-wrap gap-2">
            {DISPUTE_STATUSES.map(s => {
              const isActive = status === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatus(s.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                    isActive
                      ? 'bg-primary text-white border-primary'
                      : 'bg-dark-800 text-gray-400 border-dark-700 hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">Admin note (internal)</label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder="Internal triage notes — not shown to reporter."
            className="w-full bg-dark-900 border border-dark-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-primary focus:outline-none resize-y"
          />
        </div>

        {error && <div className="text-xs text-red-300">{error}</div>}

        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="px-4 py-1.5 rounded bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {savedAt && !dirty && (
            <span className="text-xs text-emerald-400">✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Brief card ───────────────────────────────────────────────────────────────

const BriefCard: React.FC<{ brief: Brief }> = ({ brief }) => (
  <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-white flex items-center gap-2">
        <span>📋</span> Campaign Brief
      </h3>
      <span className="text-[10px] text-gray-500">
        Sent {formatDateTime(brief.sent_at)}
        {brief.last_edited_at && brief.last_edited_at !== brief.sent_at ? ` · edited ${formatDateTime(brief.last_edited_at)}` : ''}
      </span>
    </div>

    {brief.goal && (
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Goal</div>
        <div className="text-sm text-gray-200">{brief.goal}</div>
      </div>
    )}

    {brief.anything_else && (
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Brief</div>
        <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{brief.anything_else}</div>
      </div>
    )}

    {brief.tone && brief.tone.length > 0 && (
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Tone</div>
        <div className="flex flex-wrap gap-1.5">
          {brief.tone.map(t => (
            <span key={t} className="px-2 py-0.5 rounded bg-dark-700 text-xs text-gray-300">{t}</span>
          ))}
        </div>
      </div>
    )}

    {brief.hard_deadline && (
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Deadline</div>
        <div className="text-sm text-gray-200">{formatDate(brief.hard_deadline)}</div>
      </div>
    )}

    {brief.reference_links && brief.reference_links.length > 0 && (
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Reference Links</div>
        <ul className="space-y-1">
          {brief.reference_links.map((url, idx) => (
            <li key={idx}>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:underline break-all">
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )}

    {brief.voice_note?.url && (
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Voice Note</div>
        <audio controls src={brief.voice_note.url} className="w-full" />
      </div>
    )}
  </div>
);

// ── Main component ───────────────────────────────────────────────────────────

const AdminOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightDisputeId = searchParams.get('dispute');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCreatorId, setActiveCreatorId] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await collabs.post('/admin/orders/detail', { order_id: id });
      if (res?.data?.success && res?.data?.data) {
        const o: OrderDetail = res.data.data;
        setOrder(o);
        // Pick first creator as default active tab
        const firstCreator = (o.line_items || []).find(li => li.influencer?._id)?.influencer?._id || null;
        setActiveCreatorId(prev => prev || firstCreator);
      } else {
        setError(res?.data?.message || 'Order not found');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Group line items by creator for the multi-creator tabs
  const creatorGroups = useMemo(() => {
    if (!order) return [];
    const groups = new Map<string, { creator: Influencer; items: LineItem[] }>();
    for (const li of order.line_items || []) {
      const cid = li.influencer?._id;
      if (!cid) continue;
      if (!groups.has(cid)) groups.set(cid, { creator: li.influencer!, items: [] });
      groups.get(cid)!.items.push(li);
    }
    return Array.from(groups.values());
  }, [order]);

  const activeGroup = useMemo(
    () => creatorGroups.find(g => g.creator._id === activeCreatorId) || creatorGroups[0] || null,
    [creatorGroups, activeCreatorId]
  );
  const activeChatId = activeGroup?.items.find(li => li.chat_id)?.chat_id || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-primary"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg px-4 py-6 text-center">
        {error || 'Order not found.'}
        <div className="mt-3">
          <button onClick={() => navigate('/orders')} className="text-sm text-blue-300 hover:underline">← Back to Orders</button>
        </div>
      </div>
    );
  }

  const orderStatus = STATUS_STYLES[order.fulfillment_status] || { label: order.fulfillment_status, bg: 'bg-gray-500/15', text: 'text-gray-300' };

  return (
    <div className="space-y-5">
      {/* Back link */}
      <button
        onClick={() => navigate('/orders')}
        className="text-sm text-gray-400 hover:text-white flex items-center gap-1.5"
      >
        ← Back to Orders
      </button>

      {/* Order header card */}
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {order.brand?.profile_image ? (
              <img src={order.brand.profile_image} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                {getInitials(order.brand?.brand_name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-white truncate">{order.brand?.brand_name || 'Unknown Brand'}</h1>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${orderStatus.bg} ${orderStatus.text}`}>
                  {orderStatus.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                <span className="font-mono font-bold">{shortId(order._id)}</span>
                <span>·</span>
                <span>{formatDate(order.created_date)}</span>
                <span>·</span>
                <span className="font-mono font-bold text-white">{formatAmount(order.total?.amount, order.total?.currency)}</span>
                {order.brand?.email && (
                  <>
                    <span>·</span>
                    <a href={`mailto:${order.brand.email}`} className="text-blue-300 hover:underline">{order.brand.email}</a>
                  </>
                )}
              </div>
              {(order.brand?.category || order.brand?.campaign_goal) && (
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 flex-wrap">
                  {order.brand?.category && <span>{order.brand.category}</span>}
                  {order.brand?.category && order.brand?.campaign_goal && <span>·</span>}
                  {order.brand?.campaign_goal && <span>{order.brand.campaign_goal}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-creator tabs */}
      {creatorGroups.length > 1 && (
        <div className="flex flex-wrap gap-2 bg-dark-800 border border-dark-700 rounded-xl p-2">
          {creatorGroups.map(g => {
            const isActive = activeCreatorId === g.creator._id;
            return (
              <button
                key={g.creator._id}
                onClick={() => setActiveCreatorId(g.creator._id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive ? 'bg-primary text-white' : 'bg-dark-700/40 text-gray-400 hover:bg-dark-700'
                }`}
              >
                {g.creator.profile_image ? (
                  <img src={g.creator.profile_image} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-primary/40 flex items-center justify-center text-[9px] font-bold">
                    {getInitials(g.creator.name || g.creator.username)}
                  </span>
                )}
                {g.creator.name || g.creator.username || 'Creator'}
                <span className="opacity-60">({g.items.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 2-column layout: left = items + brief + disputes; right = chat */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,420px)] gap-5">

        {/* LEFT */}
        <div className="space-y-5 min-w-0">

          {/* Active creator's line items */}
          {activeGroup && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl">
              <div className="px-5 py-3 border-b border-dark-700 flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {activeGroup.creator.name || activeGroup.creator.username || 'Creator'}'s deliverables
                </h3>
                <span className="text-xs text-gray-500">({activeGroup.items.length})</span>
              </div>
              <div className="divide-y divide-dark-700">
                {activeGroup.items.map(li => {
                  const itemStatus = STATUS_STYLES[li.fulfillment_status] || { label: li.fulfillment_status, bg: 'bg-gray-500/15', text: 'text-gray-300' };
                  return (
                    <div key={li._id} className="px-5 py-4 space-y-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{li.title || 'Untitled deliverable'}</div>
                          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            {li.platform?.label && <span>{li.platform.label}</span>}
                            {li.platform?.label && li.content_deliverable?.label && <span>·</span>}
                            {li.content_deliverable?.label && <span>{li.content_deliverable.label}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${itemStatus.bg} ${itemStatus.text}`}>
                            {itemStatus.label}
                          </span>
                          <span className="text-sm font-mono font-bold text-white">
                            {formatAmount(li.amount, li.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Submissions */}
                      {li.submissions && li.submissions.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                            Submissions ({li.submissions.length})
                          </div>
                          {li.submissions.map((s, idx) => (
                            <div key={idx} className="px-3 py-2 rounded bg-dark-900/40 border border-dark-700 text-xs">
                              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                                <span className="text-gray-300 font-semibold">
                                  {s.type === 'revision' ? '🔄 Revision' : '📎 Initial'} v{idx + 1}
                                </span>
                                <span className="text-[10px] text-gray-500">{formatDateTime(s.submitted_at)}</span>
                              </div>
                              {s.deliverable_url && (
                                <a href={s.deliverable_url} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline break-all">
                                  {s.deliverable_url}
                                </a>
                              )}
                              {s.note && <div className="text-gray-400 italic mt-1">{s.note}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Revision note */}
                      {li.revision_note && li.fulfillment_status === 'revision_requested' && (
                        <div className="px-3 py-2 rounded bg-orange-500/5 border border-orange-500/30 text-xs">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-1">
                            Revision requested · #{li.revision_count}
                          </div>
                          <div className="text-gray-300 italic">{li.revision_note}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Brief */}
          {order.brief ? <BriefCard brief={order.brief} /> : (
            <div className="bg-dark-800 border border-dark-700 rounded-xl px-5 py-6 text-center text-sm text-gray-500">
              No brief sent yet.
            </div>
          )}

          {/* Disputes */}
          {order.disputes && order.disputes.length > 0 && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl">
              <div className="px-5 py-3 border-b border-dark-700 flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">⚠ Disputes</h3>
                <span className="text-xs text-gray-500">({order.disputes.length})</span>
              </div>
              <div className="p-4 space-y-3">
                {order.disputes.map(d => (
                  <DisputeCard
                    key={d._id}
                    dispute={d}
                    highlight={d._id === highlightDisputeId}
                    onUpdated={(updated) => {
                      setOrder(prev => prev ? {
                        ...prev,
                        disputes: prev.disputes.map(x => x._id === updated._id ? updated : x),
                      } : prev);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — chat history */}
        <div className="min-w-0">
          <ChatHistoryViewer
            chatId={activeChatId}
            brand={order.brand}
            creator={activeGroup?.creator}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;
