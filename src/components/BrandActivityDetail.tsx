import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ANALYTICS_CONFIG from '../config/analyticsService';

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;
const apiHeaders = (): Record<string, string> => ({
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
});

interface BrandInfo {
  _id: string;
  email?: string;
  brand_name?: string;
  profile_image?: string;
  country?: string;
  city?: string;
  is_email_verified?: boolean;
  is_profile_completed?: boolean;
  created_at?: string;
}

interface CreatorRef {
  username?: string;
  name?: string;
  profile_image?: string;
}

interface Event {
  _id: string;
  session_id: string;
  event_type: string;
  page_url?: string;
  page_referrer?: string;
  target_id?: string;
  target_type?: string;
  duration_ms?: number;
  viewed_duration_ms?: number; // attached server-side for creator_profile_viewed
  pre_signup?: boolean; // guest event from this brand's session, before they signed up (stitched server-side)
  metadata?: Record<string, any>;
  captured_at: string;
  target_creator?: CreatorRef | null;
}

interface Session {
  session_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  event_count: number;
  events: Event[];
  // Enrichment surfaced per-session by the backend (geoip-lite + ua-parser-js
  // populated at ingest, then rolled up in getBrandTimeline). Empty strings
  // when the session predates the enrichment rollout OR the IP is private.
  ip_address?: string;
  geo_country?: string;
  geo_region?: string;
  geo_city?: string;
  device_type?: string;
  browser_name?: string;
  browser_version?: string;
  os_name?: string;
  os_version?: string;
}

interface TimelineResponse {
  brand: BrandInfo;
  aggregates: {
    last_active: string | null;
    first_seen: string | null;
    total_events: number;
    session_count: number;
    total_duration_ms: number;
    stage: string;
  };
  top_creators: Array<{ creator_id: string; count: number; username?: string; name?: string; profile_image?: string }>;
  sessions: Session[];
}

// ── helpers ────────────────────────────────────────────────────────────────

function fmtNumber(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtDuration(ms?: number): string {
  if (!ms || ms < 0) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function fmtTimeAgo(dateStr?: string | null): string {
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

function fmtTimeOfDay(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

const STAGE_STYLES: Record<string, { bg: string; text: string }> = {
  Browsing:    { bg: 'bg-gray-500/15',   text: 'text-gray-300' },
  Shortlisted: { bg: 'bg-blue-500/15',   text: 'text-blue-300' },
  Cart:        { bg: 'bg-amber-500/15',  text: 'text-amber-300' },
  Checkout:    { bg: 'bg-purple-500/15', text: 'text-purple-300' },
  Paid:        { bg: 'bg-green-500/15',  text: 'text-green-300' },
};

const EVENT_LABELS: Record<string, string> = {
  login: '🔐 Logged in',
  logout: '🚪 Logged out',
  signup_start: '✏️ Started signup',
  signup_complete: '✅ Completed signup',
  page_view: '📄 Viewed page',
  explore_filter_applied: '🎚 Applied filter',
  explore_search_submitted: '🔎 Searched',
  explore_pagination: '📃 Loaded more',
  explore_sort_changed: '↕ Changed sort',
  creator_profile_viewed: '👤 Viewed creator',
  creator_section_viewed: '📌 Viewed section',
  creator_message_clicked: '💬 Clicked message',
  creator_favorited: '❤️ Favorited creator',
  creator_unfavorited: '💔 Unfavorited creator',
  creator_external_link_clicked: '🔗 Clicked external link',
  package_added_to_cart: '🛒 Added to cart',
  cart_viewed: '🛍 Viewed cart',
  cart_item_removed: '➖ Removed from cart',
  cart_emptied: '🗑 Emptied cart',
  checkout_started: '🚦 Started checkout',
  checkout_payment_initiated: '💳 Initiated payment',
  checkout_abandoned: '🥶 Abandoned checkout',
  checkout_payment_completed: '🎉 Completed payment',
  checkout_payment_failed: '❌ Payment failed',
  order_viewed: '📦 Viewed order',
  submission_reviewed: '🔍 Reviewed submission',
  revision_requested: '↩ Requested revision',
  submission_approved: '👍 Approved submission',
  // Custom Offers funnel
  custom_offer_compose_opened: '✏️ Opened custom offer compose',
  custom_offer_submitted: '📨 Sent custom offer',
  custom_offer_submit_failed: '⚠️ Custom offer submit failed',
  custom_offer_inbox_viewed: '📥 Viewed custom offers inbox',
  custom_offer_cancelled: '🗙 Cancelled custom offer',
  custom_offer_checkout_started: '💳 Started custom-offer checkout',
  // Campaigns funnel — brand posts an open call, creators pitch, brand hires.
  campaign_post_page_opened: '📝 Opened post-campaign',
  campaign_ai_draft_requested: '✨ Requested AI draft',
  campaign_ai_draft_succeeded: '🤖 AI draft returned',
  campaign_ai_draft_failed: '⚠️ AI draft failed',
  campaign_manual_fallback_clicked: '↩ Switched to manual form',
  campaign_submit_attempted: '🚦 Attempted campaign submit',
  campaign_submitted: '📣 Posted campaign',
  campaign_submit_failed: '⚠️ Campaign submit failed',
  campaign_cancelled: '🗙 Cancelled campaign',
  campaign_detail_viewed: '👁 Viewed my campaign',
  pitch_reviewed: '🔍 Reviewed a pitch',
  pitch_hired: '🤝 Hired a creator',
  // Explore / checkout internals
  explore_results_served: '🗂 Explore results shown',
  checkout_payload_composed: '🧾 Prepared payment',
  // Creator profile (2026-10 redesign)
  profile_tab_switched: '🗂 Switched profile tab',
  profile_content_opened: '🖼 Opened creator content',
  profile_package_selected: '📦 Selected a package',
  profile_book_clicked: '🛒 Clicked Book',
  profile_social_opened: '🔗 Opened creator social',
  profile_faq_opened: '❓ Opened an FAQ',
  profile_bio_expanded: '📖 Read full bio',
  // TrustLens AI
  trustlens_card_viewed: '🔬 Saw TrustLens',
  trustlens_tab_switched: '🔀 Switched TrustLens platform',
  trustlens_learn_more_clicked: '📘 Clicked TrustLens learn more',
  // Guest gates → sign-up popup
  guest_explore_limit_hit: '🚧 Guest hit Explore limit',
  guest_profile_limit_hit: '🚧 Guest hit profile limit',
  guest_social_pill_blocked: '🔒 Guest blocked: social link',
  guest_trustlens_gated: '🔒 Guest blocked: TrustLens',
  guest_stats_gated: '🔒 Guest blocked: stats',
  guest_join_modal_opened: '🪟 Sign-up popup opened',
  guest_join_modal_submitted: '📝 Sign-up submitted',
  guest_join_modal_signup_success: '✅ Signed up from popup',
  guest_join_modal_signup_failed: '⚠️ Popup sign-up failed',
  guest_join_modal_login_clicked: '🔑 Popup: chose log in',
  // Direct Message → Collab flow
  collab_message_clicked: '💬 Clicked Message',
  collab_compose_opened: '✏️ Opened message form',
  collab_ai_draft_requested: '✨ Requested AI brief',
  collab_ai_draft_succeeded: '🤖 AI brief returned',
  collab_ai_draft_failed: '⚠️ AI brief failed',
  collab_request_sent: '📨 Sent collab request',
  collab_request_failed: '⚠️ Collab request failed',
  collab_thread_viewed: '👁 Viewed collab thread',
  collab_offer_sent: '💸 Sent an offer',
  collab_offer_accepted: '🤝 Accepted an offer',
  collab_offer_declined: '🙅 Declined an offer',
  collab_offer_withdrawn: '↩ Withdrew an offer',
  collab_checkout_started: '💳 Started collab checkout',
};

function eventLabel(t: string): string {
  return EVENT_LABELS[t] || t;
}

// ── component ──────────────────────────────────────────────────────────────

const BrandActivityDetail: React.FC = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const fetchTimeline = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/events/brand-activity/${brandId}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as TimelineResponse;
      setData(body);
      // Auto-expand the most recent session
      if (body.sessions[0]) {
        setExpandedSessions({ [body.sessions[0].session_id]: true });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const toggleSession = (sid: string) => {
    setExpandedSessions((prev) => ({ ...prev, [sid]: !prev[sid] }));
  };

  if (loading) {
    return (
      <div className="text-gray-400 text-sm">Loading brand activity…</div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg">
        {error || 'No data'}
      </div>
    );
  }

  const { brand, aggregates, top_creators, sessions } = data;
  const stageStyle = STAGE_STYLES[aggregates.stage] || STAGE_STYLES.Browsing;

  return (
    <div className="text-gray-100">
      {/* Back link */}
      <button
        onClick={() => navigate('/brand-activity')}
        className="text-primary hover:text-primary-accent text-sm font-medium mb-4 inline-flex items-center gap-1"
      >
        ← All brand activity
      </button>

      {/* Brand header */}
      <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          {brand.profile_image ? (
            <img src={brand.profile_image} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center text-xl text-gray-400">
              {brand.brand_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{brand.brand_name || '(missing name)'}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${stageStyle.bg} ${stageStyle.text}`}>
                {aggregates.stage}
              </span>
              {!brand.is_email_verified && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/15 text-orange-300">
                  Unverified email
                </span>
              )}
              {!brand.is_profile_completed && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/15 text-yellow-300">
                  Profile incomplete
                </span>
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">{brand.email}</div>
            {(brand.city || brand.country) && (
              <div className="text-xs text-gray-500 mt-0.5">
                {[brand.city, brand.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <button
            onClick={() => navigate(`/brands/${brand._id}`)}
            className="text-xs text-gray-400 hover:text-primary"
          >
            View brand profile →
          </button>
        </div>
      </div>

      {/* Aggregates grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Last active</div>
          <div className="text-base font-bold text-white mt-0.5">{fmtTimeAgo(aggregates.last_active)}</div>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">First seen</div>
          <div className="text-base font-bold text-white mt-0.5">{fmtTimeAgo(aggregates.first_seen)}</div>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total events</div>
          <div className="text-base font-bold text-white mt-0.5">{fmtNumber(aggregates.total_events)}</div>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Sessions</div>
          <div className="text-base font-bold text-white mt-0.5">{fmtNumber(aggregates.session_count)}</div>
        </div>
        <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total time</div>
          <div className="text-base font-bold text-white mt-0.5">{fmtDuration(aggregates.total_duration_ms)}</div>
        </div>
      </div>

      {/* Top creators viewed */}
      {top_creators.length > 0 && (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 mb-6">
          <div className="text-sm font-semibold text-gray-300 mb-3">Most-viewed creators</div>
          <div className="flex flex-wrap gap-3">
            {top_creators.map((c) => (
              <div key={c.creator_id} className="flex items-center gap-2 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2">
                {c.profile_image ? (
                  <img src={c.profile_image} alt="" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-dark-700" />
                )}
                <div className="text-xs">
                  <div className="font-medium">@{c.username || c.name || c.creator_id.slice(-6)}</div>
                  <div className="text-gray-500">{c.count}× viewed</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions timeline */}
      <div className="text-sm font-semibold text-gray-300 mb-3">Sessions ({sessions.length})</div>
      <div className="space-y-3">
        {sessions.map((s) => {
          const open = !!expandedSessions[s.session_id];
          return (
            <div key={s.session_id} className="bg-dark-800 border border-dark-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSession(s.session_id)}
                className="w-full flex items-center justify-between gap-2 px-3 md:px-4 py-3 hover:bg-dark-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2 md:gap-3 text-sm flex-1 min-w-0">
                  <span className="text-gray-500 font-mono text-xs w-4 md:w-12 flex-shrink-0">{open ? '▼' : '▶'}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-white">
                      {fmtTimeOfDay(s.started_at)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">
                        <span className="font-mono">{s.session_id.slice(0, 8)}…</span>
                      </span>
                      {/* Geo chip — city, region, country */}
                      {(s.geo_city || s.geo_country) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          📍 {[s.geo_city, s.geo_region, s.geo_country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {/* Device chip — type */}
                      {s.device_type && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          s.device_type === 'mobile' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                          s.device_type === 'tablet' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                          s.device_type === 'bot'    ? 'bg-red-500/15 text-red-300 border-red-500/30' :
                                                       'bg-gray-500/15 text-gray-300 border-gray-500/30'
                        }`}>
                          {s.device_type === 'mobile' ? '📱' : s.device_type === 'tablet' ? '📱' : s.device_type === 'bot' ? '🤖' : '🖥️'} {s.device_type}
                        </span>
                      )}
                      {/* Browser + OS chip */}
                      {(s.browser_name || s.os_name) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
                          {s.browser_name} {s.browser_version ? s.browser_version.split('.')[0] : ''} · {s.os_name} {s.os_version ? s.os_version.split('.')[0] : ''}
                        </span>
                      )}
                      {/* IP chip (optional, muted) */}
                      {s.ip_address && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-dark-700 text-gray-500 border border-dark-600" title="Client IP">
                          {s.ip_address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-end md:items-center gap-0.5 md:gap-4 text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                  <span>{s.event_count} events</span>
                  <span>{fmtDuration(s.duration_ms)}</span>
                </div>
              </button>

              {open && (
                <div className="border-t border-dark-700 bg-dark-900/40">
                  <ol className="divide-y divide-dark-700">
                    {s.events
                      .filter((e, idx, arr) => {
                        // Dedupe: drop page_view that fires within 5s of a
                        // creator_profile_viewed for the SAME creator. The two
                        // events represent one logical "arrived on profile."
                        if (e.event_type !== 'page_view' || !e.target_creator) return true;
                        const t = new Date(e.captured_at).getTime();
                        return !arr.some((other) => {
                          if (other === e) return false;
                          if (other.event_type !== 'creator_profile_viewed') return false;
                          if (!other.target_creator) return false;
                          if (other.target_creator.username !== e.target_creator?.username) return false;
                          const dt = Math.abs(t - new Date(other.captured_at).getTime());
                          return dt < 5000;
                        });
                      })
                      .map((e) => {
                      // Highlight high-intent (long view) creator visits
                      const longView =
                        e.event_type === 'creator_profile_viewed' &&
                        typeof e.viewed_duration_ms === 'number' &&
                        e.viewed_duration_ms >= 30_000;
                      return (
                        <li
                          key={e._id}
                          // Phones: time + event on one line, details wrap underneath (they were squeezed to nothing).
                          className={`px-3 md:px-4 py-2.5 flex flex-wrap md:flex-nowrap items-start gap-x-3 gap-y-0.5 text-sm ${longView ? 'bg-blue-500/5' : ''}`}
                        >
                          <span className="text-xs text-gray-500 font-mono mt-0.5 whitespace-nowrap">
                            {new Date(e.captured_at).toLocaleTimeString()}
                          </span>
                          <span className="text-gray-200 min-w-0 md:whitespace-nowrap">
                            {eventLabel(e.event_type)}
                            {e.pre_signup && (
                              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold uppercase tracking-wide align-middle" title="Done as a guest in the same visit, before signing up">
                                before signup
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500 min-w-0 basis-full md:basis-auto md:flex-1 break-words md:truncate">
                            {e.target_creator
                              ? `@${e.target_creator.username || e.target_creator.name}`
                              : e.page_url || ''}
                            {e.metadata?.search_query ? ` "${e.metadata.search_query}"` : ''}
                            {e.metadata?.amount ? ` · ${e.metadata.amount} ${e.metadata.currency || ''}` : ''}
                            {e.metadata?.surface ? ` · via ${({ inline: 'button under bio', bar: 'bottom bar', card: 'booking card' } as Record<string, string>)[e.metadata.surface] || e.metadata.surface}` : ''}
                            {e.event_type === 'explore_filter_applied' && (() => {
                              const af = e.metadata?.applied_filters;
                              // New shape (key→value object). Renders pills like "GENDER: Female".
                              if (af && typeof af === 'object' && !Array.isArray(af)) {
                                const entries = Object.entries(af);
                                if (entries.length === 0) {
                                  return <span className="ml-1 text-gray-500 italic">(cleared)</span>;
                                }
                                return (
                                  <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                                    {entries.map(([k, v]) => (
                                      <span
                                        key={k}
                                        className="inline-flex items-baseline gap-1 bg-blue-500/15 text-blue-300 text-[10px] px-1.5 py-0.5 rounded"
                                      >
                                        <span className="font-semibold uppercase tracking-wider opacity-70">
                                          {k.replace(/_/g, ' ')}:
                                        </span>
                                        <span>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                                      </span>
                                    ))}
                                  </span>
                                );
                              }
                              // Legacy shape (pre-2026-05-14 events): array of keys with no values.
                              if (Array.isArray(af)) {
                                if (af.length === 0) {
                                  return <span className="ml-1 text-gray-500 italic">(cleared)</span>;
                                }
                                return (
                                  <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                                    {af.map((k: string) => (
                                      <span
                                        key={k}
                                        className="inline-block bg-blue-500/15 text-blue-300 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                      >
                                        {String(k).replace(/_/g, ' ')}
                                      </span>
                                    ))}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {e.event_type === 'creator_profile_viewed' && typeof e.viewed_duration_ms === 'number' && (
                              <span className={`ml-2 ${longView ? 'text-blue-300 font-semibold' : 'text-gray-400'}`}>
                                ({fmtDuration(e.viewed_duration_ms)})
                              </span>
                            )}
                            {e.event_type === 'checkout_abandoned' && e.metadata?.synthetic && (
                              <span className="ml-2 text-amber-400 italic">(auto-detected, no checkout in {Math.round((e.duration_ms || 0) / 60000)}m)</span>
                            )}
                            {e.event_type === 'checkout_payment_failed' && e.metadata?.err_msg && (
                              <span className="ml-2 text-red-400">— {e.metadata.err_msg}</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
        {sessions.length === 0 && (
          <div className="bg-dark-800 border border-dark-700 rounded-lg px-4 py-6 text-center text-gray-500 text-sm">
            No sessions recorded.
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandActivityDetail;
