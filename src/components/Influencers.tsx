import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Influencer } from '../types';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { getCreators, deleteCreator } from '../store/actions/creatorAction';
import { getCountries, getStates, getCities } from '../store/actions/globalActions';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

// ── Styles ─────────────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes inf-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .inf-shimmer {
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    animation: inf-shimmer 1.5s ease-in-out infinite;
    border-radius: 6px;
  }
  .inf-filter-panel {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.35s ease;
  }
  .inf-filter-panel.open { max-height: 700px; }
  .inf-filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (min-width: 768px)  { .inf-filter-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1024px) { .inf-filter-grid { grid-template-columns: repeat(4, 1fr); } }
  .inf-card-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 640px)  { .inf-card-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .inf-card-grid { grid-template-columns: repeat(3, 1fr); } }
  .inf-table-wrap { overflow-x: auto; }
  .inf-tr:hover td { background: rgba(255,255,255,0.025) !important; }
  .inf-select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px !important;
  }
  .inf-input:focus, .inf-select:focus {
    outline: none;
    border-color: #4f46e5 !important;
    box-shadow: 0 0 0 2px rgba(79,70,229,0.2);
  }
  .inf-search-wrap { position: relative; width: 100%; }
  @media (min-width: 640px) { .inf-search-wrap { width: 280px; } }
  .inf-page-btn {
    min-width: 32px; height: 32px; padding: 0 8px;
    border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
    background: transparent; color: #9ca3af;
    font-size: 13px; cursor: pointer;
    transition: all 0.15s ease;
    display: flex; align-items: center; justify-content: center;
  }
  .inf-page-btn:hover:not(:disabled):not(.active) { background: rgba(255,255,255,0.06); color: #e5e7eb; }
  .inf-page-btn.active  { background: #4f46e5; border-color: #4f46e5; color: #fff; }
  .inf-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .inf-select option {
    background: #1e2130;
    color: #e5e7eb;
  }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatJoinDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr.split('T')[0];
  }
}

// Legacy creators are missing the manual `created_date` field. Prefer it
// when present (kept for parity with older admin queries), otherwise fall
// back to Mongoose's auto-timestamps `created_at`, and finally derive from
// the ObjectId itself (the first 4 bytes are the insertion Unix timestamp,
// which every Mongo doc has for free).
function pickJoinDate(inf: any): string {
  if (inf?.created_date) return inf.created_date;
  if (inf?.created_at)   return inf.created_at;
  const id = inf?._id ? String(inf._id) : '';
  if (id.length >= 8) {
    const seconds = parseInt(id.substring(0, 8), 16);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return '';
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Approval label resolver. Reads `approval_status` if present, otherwise
// falls back to the legacy `is_approved_by_admin` boolean. New code should
// always set both, but historical / migrated docs may have only the boolean.
function approvalLabel(inf: any): 'Approved' | 'Declined' | 'Re-review' | 'Not Approved' {
  const s = inf?.approval_status;
  if (s === 'approved') return 'Approved';
  if (s === 'declined') return 'Declined';
  if (s === 'pending_re_review') return 'Re-review';
  if (inf?.is_approved_by_admin) return 'Approved';
  return 'Not Approved';
}

// "Previously declined N×" indicator. Renders only when the creator has at
// least one prior decline AND they're currently in any status other than
// 'declined' (where the main badge already says Declined). Useful trust signal
// for repeat-rejected creators.
function DeclineHistoryBadge({ inf }: { inf: any }) {
  const history = Array.isArray(inf?.decline_history) ? inf.decline_history : [];
  if (history.length === 0) return null;
  if (inf?.approval_status === 'declined') return null;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: 'rgba(245,158,11,0.12)',
        color: '#fbbf24',
        border: '1px solid rgba(245,158,11,0.25)',
        whiteSpace: 'nowrap',
      }}
      title={`This creator was previously declined ${history.length} time(s)`}
    >
      Declined {history.length}×
    </span>
  );
}

// Renders a "TrustLens: 3d ago" pill that tints by staleness. The auto-resync
// scheduler runs every 14 days; we color amber after 20 days (cycle missed)
// and red after 35 days (two cycles missed — actual problem).
// Only shown for approved+active creators (the only ones the resync touches).
function TrustLensFreshness({ inf }: { inf: any }) {
  if (!inf?.is_approved_by_admin || !inf?.is_active) return null;
  const ts = inf?.trustLensLastSyncedAt;
  if (!ts) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.25)',
      }} title="No TrustLens sync recorded yet">
        TrustLens: never
      </span>
    );
  }
  const ageMs = Date.now() - new Date(ts).getTime();
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const label =
    ageMs < 60 * 60 * 1000   ? 'just now' :
    ageMs < 24 * 60 * 60 * 1000 ? `${Math.floor(ageMs / (60 * 60 * 1000))}h ago` :
    `${ageDays}d ago`;
  // Color thresholds: <20d green, 20-35d amber, >35d red
  let bg = 'rgba(34,197,94,0.12)', col = '#86efac', bd = 'rgba(34,197,94,0.25)';
  if (ageDays > 35)      { bg = 'rgba(239,68,68,0.15)';  col = '#fca5a5'; bd = 'rgba(239,68,68,0.3)'; }
  else if (ageDays > 20) { bg = 'rgba(245,158,11,0.15)'; col = '#fcd34d'; bd = 'rgba(245,158,11,0.3)'; }
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: bg, color: col, border: `1px solid ${bd}`, whiteSpace: 'nowrap',
      }}
      title={`TrustLens last synced ${new Date(ts).toLocaleString()}`}
    >
      TrustLens: {label}
    </span>
  );
}

function getPageRange(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: Array<number | 'gap'> = [];
  pages.push(1);
  if (current > 3) pages.push('gap');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('gap');
  pages.push(total);
  return pages;
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

const EyeIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FilterIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const ChevronDownIcon = ({ rotate }: { rotate?: boolean }) => (
  <svg
    width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"
    style={{ transition: 'transform 0.25s ease', transform: rotate ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
  >
    <polyline strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} points="6 9 12 15 18 9" />
  </svg>
);

const TableIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M3 3h18a1 1 0 011 1v16a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" />
  </svg>
);

const GridIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
    <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
    <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
    <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
  </svg>
);

const XIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── StatusBadge ────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let bg = '', color = '';
  switch (status) {
    case 'Complete':
    case 'Approved':
      bg = 'rgba(16,185,129,0.15)'; color = '#10b981'; break;
    case 'Incomplete':
      bg = 'rgba(239,68,68,0.15)'; color = '#ef4444'; break;
    case 'Pending':
    case 'Not Approved':
    case 'Re-review':
      bg = 'rgba(245,158,11,0.15)'; color = '#f59e0b'; break;
    case 'Declined':
      bg = 'rgba(239,68,68,0.15)'; color = '#ef4444'; break;
    case 'Inactive':
      bg = 'rgba(156,163,175,0.12)'; color = '#9ca3af'; break;
    default:
      bg = 'rgba(156,163,175,0.1)'; color = '#9ca3af';
  }
  return (
    <span style={{
      background: bg, color, borderRadius: 20, fontSize: 11, fontWeight: 600,
      padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {status}
    </span>
  );
};

// ── Skeleton components ────────────────────────────────────────────────────────

const SkeletonTableRow: React.FC = () => (
  <tr>
    {[160, 90, 110, 80, 70, 80, 80, 40].map((w, i) => (
      <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="inf-shimmer" style={{ height: 12, width: w }} />
      </td>
    ))}
  </tr>
);

const SkeletonCard: React.FC = () => (
  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div className="inf-shimmer" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="inf-shimmer" style={{ height: 12, width: '55%', marginBottom: 8 }} />
        <div className="inf-shimmer" style={{ height: 10, width: '75%' }} />
      </div>
    </div>
    <div className="inf-shimmer" style={{ height: 10, width: '35%', marginBottom: 10 }} />
    <div style={{ display: 'flex', gap: 8 }}>
      <div className="inf-shimmer" style={{ height: 22, width: 72, borderRadius: 12 }} />
      <div className="inf-shimmer" style={{ height: 22, width: 72, borderRadius: 12 }} />
    </div>
  </div>
);

// ── Empty state ────────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ hasFilters: boolean; onClear: () => void }> = ({ hasFilters, onClear }) => (
  <div style={{ textAlign: 'center', padding: '60px 24px', color: '#9ca3af' }}>
    <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
    <p style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', margin: '0 0 8px' }}>No influencers found</p>
    <p style={{ fontSize: 13, margin: '0 0 20px', color: '#6b7280' }}>
      {hasFilters ? 'No results match your current filters.' : 'No influencers have signed up yet.'}
    </p>
    {hasFilters && (
      <button
        onClick={onClear}
        style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Clear Filters
      </button>
    )}
  </div>
);

// ── Social chips ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#e1306c', youtube: '#ff0000', tiktok: '#69c9d0',
  twitter: '#1da1f2', x: '#e5e7eb', facebook: '#1877f2',
  linkedin: '#0a66c2', snapchat: '#f9d71c', twitch: '#9146ff',
};

const SocialsCell: React.FC<{ influencer: any }> = ({ influencer }) => {
  const links: Array<{ platform: string }> = Array.isArray(influencer.social_links) ? influencer.social_links : [];
  if (links.length === 0) return <span style={{ color: '#4b5563', fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {links.slice(0, 3).map((l, i) => (
        <span key={i} style={{ fontSize: 10, fontWeight: 600, borderRadius: 10, padding: '2px 8px', background: 'rgba(255,255,255,0.06)', color: PLATFORM_COLORS[l.platform?.toLowerCase()] ?? '#9ca3af', textTransform: 'capitalize' }}>
          {l.platform}
        </span>
      ))}
      {links.length > 3 && <span style={{ fontSize: 10, color: '#6b7280', padding: '2px 4px' }}>+{links.length - 3}</span>}
    </div>
  );
};

const CardSocialsRow: React.FC<{ influencer: any }> = ({ influencer }) => {
  const links: Array<{ platform: string }> = Array.isArray(influencer.social_links) ? influencer.social_links : [];
  if (links.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
      {links.map((l, i) => (
        <span key={i} style={{ fontSize: 10, fontWeight: 600, borderRadius: 12, padding: '3px 10px', background: 'rgba(255,255,255,0.06)', color: PLATFORM_COLORS[l.platform?.toLowerCase()] ?? '#9ca3af', textTransform: 'capitalize' }}>
          {l.platform}
        </span>
      ))}
    </div>
  );
};

// ── Debounce hook ──────────────────────────────────────────────────────────────

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// ── Filter-state persistence ──────────────────────────────────────────────────
// Survives navigation to /influencers/:id and back (e.g., approval loop where the
// admin opens a profile, approves, gets bounced to the list, and would otherwise
// have to re-apply every filter). sessionStorage (not localStorage) so a fresh
// admin session starts clean — but every filter persists across the approval
// click → list → next profile loop.

const FILTER_STORAGE_KEY = 'cc-admin-influencers-filter-state';

const DEFAULT_FILTERS = {
  is_active:            '',
  is_email_verified:    '',
  is_profile_completed: '',
  is_approved_by_admin: '',
  is_featured:          '',
  country:              '',
  state:                '',
  city:                 '',
  gender:               '',
  status:               'All',
};

interface PersistedFilterState {
  searchQuery:  string;
  currentPage:  number;
  itemsPerPage: number;
  view:         'table' | 'cards';
  showFilters:  boolean;
  filters:      typeof DEFAULT_FILTERS;
  countryId:    string;
  stateId:      string;
  cityId:       string;
}

function loadFilterState(): Partial<PersistedFilterState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveFilterState(state: PersistedFilterState) {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function clearFilterStorage() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(FILTER_STORAGE_KEY); } catch { /* ignore */ }
}

// ── Main component ─────────────────────────────────────────────────────────────

const Influencers: React.FC = () => {
  const dispatch  = useDispatch();
  const creators  = useSelector((state: any) => state.creators);
  const locations = useSelector((state: any) => state.locationsRed);
  const navigate  = useNavigate();
  const location  = useLocation() as any;

  // Load persisted state ONCE on mount. Subsequent renders won't re-hit storage.
  const persisted = useMemo(() => loadFilterState(), []);

  const [searchQuery,        setSearchQuery]        = useState<string>(persisted?.searchQuery ?? '');
  const [currentPage,        setCurrentPage]        = useState<number>(persisted?.currentPage ?? location.state?.currentPage ?? 1);
  const [itemsPerPage,       setItemsPerPage]       = useState<number>(persisted?.itemsPerPage ?? location.state?.itemsPerPage ?? 10);
  const [isDeleteModalOpen,  setDeleteModalOpen]    = useState(false);
  const [influencerToDelete, setInfluencerToDelete] = useState<Influencer | null>(null);
  const [isLoading,          setIsLoading]          = useState(true);
  const [view,               setView]               = useState<'table' | 'cards'>(persisted?.view ?? 'table');
  const [showFilters,        setShowFilters]        = useState<boolean>(persisted?.showFilters ?? false);
  const isRestoringFromNavigation = useRef(false);

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...(persisted?.filters || {}) });

  const [countryId, setCountryId] = useState<string>(persisted?.countryId ?? '');
  const [stateId,   setStateId]   = useState<string>(persisted?.stateId   ?? '');
  const [cityId,    setCityId]    = useState<string>(persisted?.cityId    ?? '');

  const debouncedCountry = useDebounce(filters.country, 500);
  const debouncedState   = useDebounce(filters.state,   500);
  const debouncedCity    = useDebounce(filters.city,    500);

  const activeFilterCount = useMemo(() => {
    const { status, ...rest } = filters;
    return Object.values(rest).filter(v => v !== '').length + (status !== 'All' ? 1 : 0);
  }, [filters]);

  // ── Filter handlers ──

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleCountryChange = (id: string) => {
    setCountryId(id);
    const country = locations?.countries?.countries?.find((c: any) => c._id === id);
    handleFilterChange('country', country?.name || '');
    setStateId('');
    handleFilterChange('state', '');
    handleFilterChange('city', '');
  };

  const handleStateChange = (id: string) => {
    setStateId(id);
    const state = locations?.states?.country?.states?.find((s: any) => s._id === id);
    handleFilterChange('state', state?.name || '');
    handleFilterChange('city', '');
  };

  const handleCityChange = (id: string) => {
    setCityId(id);
    const city = locations?.cities?.country?.state?.cities?.find((c: any) => c._id === id);
    handleFilterChange('city', city?.name || '');
  };

  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setCountryId(''); setStateId(''); setCityId('');
    setSearchQuery(''); setCurrentPage(1);
    clearFilterStorage(); // Drop the persisted snapshot too — Clear means clear.
  };

  // Persist filter state on every change so the approval-loop workflow
  // (list → profile → approve → back to list) restores filters without
  // the admin having to re-apply them.
  useEffect(() => {
    saveFilterState({
      searchQuery, currentPage, itemsPerPage, view, showFilters,
      filters, countryId, stateId, cityId,
    });
  }, [searchQuery, currentPage, itemsPerPage, view, showFilters, filters, countryId, stateId, cityId]);

  // ── Effects ──

  useEffect(() => {
    dispatch(getCountries(1, true, () => {}) as unknown as any);
  }, [dispatch]);

  useEffect(() => {
    if (countryId) {
      dispatch(getStates(countryId, 1, true, () => {}) as unknown as any);
    } else {
      dispatch({ type: 'GET_STATES', payload: null });
    }
  }, [countryId, dispatch]);

  useEffect(() => {
    if (stateId && countryId) {
      dispatch(getCities(countryId, stateId, 1, true, () => {}) as unknown as any);
    } else {
      dispatch({ type: 'GET_CITIES', payload: null });
    }
  }, [stateId, countryId, dispatch]);

  useEffect(() => {
    if (location.state) {
      const { currentPage: savedPage, itemsPerPage: savedIpp } = location.state;
      if (savedPage !== undefined || savedIpp !== undefined) {
        isRestoringFromNavigation.current = true;
        if (savedPage !== undefined) setCurrentPage(savedPage);
        if (savedIpp  !== undefined) setItemsPerPage(savedIpp);
        setTimeout(() => { isRestoringFromNavigation.current = false; }, 100);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    setIsLoading(true);
    dispatch(getCreators(
      searchQuery ? 1000 : itemsPerPage,
      searchQuery ? 1 : currentPage,
      filters.is_active, filters.is_email_verified, filters.is_profile_completed,
      filters.is_approved_by_admin, filters.is_featured,
      debouncedCountry, debouncedState, debouncedCity, filters.gender,
      (_success: boolean) => { setIsLoading(false); }
    ) as unknown as any);
  }, [
    dispatch, searchQuery, itemsPerPage, currentPage,
    filters.is_active, filters.is_email_verified, filters.is_profile_completed,
    filters.is_approved_by_admin, filters.is_featured,
    debouncedCountry, debouncedState, debouncedCity, filters.gender,
  ]);

  useEffect(() => {
    if (!isRestoringFromNavigation.current) setCurrentPage(1);
  }, [searchQuery]);

  // ── Derived ──

  const filteredInfluencers = useMemo(() => {
    if (!creators?.profiles || !Array.isArray(creators.profiles)) return [];
    if (!searchQuery) return creators.profiles;
    const q = searchQuery.toLowerCase();
    return creators.profiles.filter((inf: any) =>
      inf.name?.toLowerCase().includes(q) ||
      inf.email?.toLowerCase().includes(q)
    );
  }, [creators?.profiles, searchQuery]);

  const totalCount = creators?.pagination?.total_count ?? 0;
  const totalPages = totalCount ? Math.ceil(totalCount / itemsPerPage) : 1;
  const showStart  = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showEnd    = Math.min(currentPage * itemsPerPage, totalCount);
  const pageRange  = getPageRange(currentPage, totalPages);

  // ── Action handlers ──

  const handleViewProfile = (influencer: any) => {
    navigate(`/influencers/${influencer._id}`, { state: { influencer, currentPage, itemsPerPage } });
  };

  const handleOpenDeleteModal  = (influencer: Influencer) => { setInfluencerToDelete(influencer); setDeleteModalOpen(true); };
  const handleCloseDeleteModal = () => { setInfluencerToDelete(null); setDeleteModalOpen(false); };
  const handleConfirmDelete    = () => {
    if (influencerToDelete) {
      dispatch(deleteCreator(influencerToDelete._id, (_success: boolean) => {
        setIsLoading(false);
      }) as unknown as any);
      handleCloseDeleteModal();
    }
  };

  // ── Shared field style ──

  const fieldStyle: React.CSSProperties = {
    width: '100%', height: 36, padding: '0 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#e5e7eb', fontSize: 13,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ margin: '-24px', padding: '24px', minHeight: '100%', background: '#1a1d2e' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f9fafb', lineHeight: 1.3 }}>Influencers</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
              {totalCount > 0 ? `${totalCount.toLocaleString()} total creators` : 'Manage creator accounts'}
            </p>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {(['table', 'cards'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 16px', border: 'none',
                  background: view === v ? '#4f46e5' : 'transparent',
                  color: view === v ? '#fff' : '#6b7280',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
              >
                {v === 'table' ? <TableIcon /> : <GridIcon />}
                <span>{v === 'table' ? 'Table' : 'Cards'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          {/* Search */}
          <div className="inf-search-wrap">
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none', display: 'flex' }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="inf-input"
              style={{ ...fieldStyle, paddingLeft: 34, paddingRight: searchQuery ? 32 : 12 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                aria-label="Clear search"
              >
                <XIcon />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '0 14px', height: 36, borderRadius: 8, flexShrink: 0,
              border: `1px solid ${showFilters ? '#4f46e5' : 'rgba(255,255,255,0.1)'}`,
              background: showFilters ? 'rgba(79,70,229,0.12)' : 'transparent',
              color: showFilters ? '#818cf8' : '#9ca3af',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <FilterIcon />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span style={{ background: '#4f46e5', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>
                {activeFilterCount}
              </span>
            )}
            <ChevronDownIcon rotate={showFilters} />
          </button>
        </div>

        {/* Collapsible filter panel */}
        <div className={`inf-filter-panel${showFilters ? ' open' : ''}`}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 16px 12px', marginBottom: 16 }}>
            <div className="inf-filter-grid">

              <div>
                <label style={labelStyle}>Gender</label>
                <select className="inf-select" value={filters.gender} onChange={e => handleFilterChange('gender', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Active</label>
                <select className="inf-select" value={filters.is_active} onChange={e => handleFilterChange('is_active', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Email Verified</label>
                <select className="inf-select" value={filters.is_email_verified} onChange={e => handleFilterChange('is_email_verified', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Profile Complete</label>
                <select className="inf-select" value={filters.is_profile_completed} onChange={e => handleFilterChange('is_profile_completed', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Approval Status</label>
                <select className="inf-select" value={filters.is_approved_by_admin} onChange={e => handleFilterChange('is_approved_by_admin', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Approved</option>
                  <option value="0">Not approved (pending)</option>
                  <option value="declined">Declined</option>
                  <option value="pending_re_review">Re-review</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Featured</label>
                <select className="inf-select" value={filters.is_featured} onChange={e => handleFilterChange('is_featured', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Yes</option>
                  <option value="0">No</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Country</label>
                <select className="inf-select" value={countryId} onChange={e => handleCountryChange(e.target.value)} style={fieldStyle}>
                  <option value="">All Countries</option>
                  {locations?.countries?.countries?.map((c: any) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>State</label>
                <select className="inf-select" value={stateId} onChange={e => handleStateChange(e.target.value)} disabled={!countryId} style={{ ...fieldStyle, opacity: countryId ? 1 : 0.4, cursor: countryId ? 'default' : 'not-allowed' }}>
                  <option value="">All States</option>
                  {locations?.states?.country?.states?.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>City</label>
                <select className="inf-select" value={cityId} onChange={e => handleCityChange(e.target.value)} disabled={!stateId} style={{ ...fieldStyle, opacity: stateId ? 1 : 0.4, cursor: stateId ? 'default' : 'not-allowed' }}>
                  <option value="">All Cities</option>
                  {locations?.cities?.country?.state?.cities?.map((c: any) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

            </div>

            {activeFilterCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>
                  Clear All ({activeFilterCount})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main content card */}
        <div style={{ background: '#242736', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>

          {/* ── TABLE VIEW ── */}
          {view === 'table' && (
            <div className="inf-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Creator', 'Phone', 'Location', 'Profile', 'Approval', 'Joined', 'Action'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: '#242736' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonTableRow key={i} />)
                  ) : filteredInfluencers.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState hasFilters={activeFilterCount > 0 || !!searchQuery} onClear={clearFilters} />
                      </td>
                    </tr>
                  ) : (
                    filteredInfluencers.map((inf: any) => (
                      <tr key={inf._id} className="inf-tr" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        {/* Creator */}
                        <td style={{ padding: '12px 16px', minWidth: 190 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {inf.profile_image ? (
                              <img src={inf.profile_image} alt={inf.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#374151' }} />
                            ) : (
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                                {getInitials(inf.name)}
                              </div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: '#f9fafb', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{inf.name}</div>
                              <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{inf.email}</div>
                            </div>
                          </div>
                        </td>
                        {/* Phone */}
                        <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{inf.phone || '—'}</td>
                        {/* Location */}
                        <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                          {[capitalize(inf.city), capitalize(inf.country)].filter(Boolean).join(', ') || '—'}
                        </td>
                        {/* Profile */}
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge status={inf.is_profile_completed ? 'Complete' : 'Incomplete'} />
                        </td>
                        {/* Approval + TrustLens freshness */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                            <StatusBadge status={approvalLabel(inf)} />
                            <DeclineHistoryBadge inf={inf} />
                            <TrustLensFreshness inf={inf} />
                          </div>
                        </td>
                        {/* Joined */}
                        <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap', fontSize: 12 }}>
                          {formatJoinDate(pickJoinDate(inf))}
                        </td>
                        {/* Action */}
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => handleViewProfile(inf)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', cursor: 'pointer', transition: 'all 0.15s ease' }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(79,70,229,0.15)'; b.style.color = '#818cf8'; b.style.borderColor = '#4f46e5'; }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = '#9ca3af'; b.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                            aria-label="View profile"
                          >
                            <EyeIcon />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── CARD VIEW ── */}
          {view === 'cards' && (
            <div style={{ padding: 20 }}>
              {isLoading ? (
                <div className="inf-card-grid">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : filteredInfluencers.length === 0 ? (
                <EmptyState hasFilters={activeFilterCount > 0 || !!searchQuery} onClear={clearFilters} />
              ) : (
                <div className="inf-card-grid">
                  {filteredInfluencers.map((inf: any) => (
                    <div
                      key={inf._id}
                      onClick={() => handleViewProfile(inf)}
                      style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: 20, cursor: 'pointer', transition: 'border-color 0.15s ease, background 0.15s ease' }}
                      onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'rgba(79,70,229,0.4)'; d.style.background = 'rgba(79,70,229,0.05)'; }}
                      onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor = 'rgba(255,255,255,0.07)'; d.style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        {inf.profile_image ? (
                          <img src={inf.profile_image} alt={inf.name} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                            {getInitials(inf.name)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#f9fafb', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inf.name}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inf.email}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <StatusBadge status={approvalLabel(inf)} />
                          <DeclineHistoryBadge inf={inf} />
                        </div>
                      </div>

                      {/* Meta */}
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
                        {[capitalize(inf.city), capitalize(inf.country)].filter(Boolean).join(', ') || 'Location unknown'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 12 }}>
                        Joined {formatJoinDate(pickJoinDate(inf))}
                      </div>

                      {/* Status chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <StatusBadge status={inf.is_profile_completed ? 'Complete' : 'Incomplete'} />
                        {!inf.is_active && <StatusBadge status="Inactive" />}
                        <TrustLensFreshness inf={inf} />
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PAGINATION ── */}
          {!isLoading && filteredInfluencers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>

              {/* Left: showing + per-page */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#9ca3af' }}>
                  Showing{' '}
                  <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{showStart}–{showEnd}</span>
                  {' '}of{' '}
                  <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{totalCount.toLocaleString()}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="inf-select"
                    style={{ ...fieldStyle, width: 68, height: 30, fontSize: 12, padding: '0 10px' }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Right: page buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <button className="inf-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} aria-label="Previous page">←</button>
                {pageRange.map((p, i) =>
                  p === 'gap' ? (
                    <span key={`gap-${i}`} style={{ color: '#6b7280', fontSize: 13, padding: '0 4px', userSelect: 'none' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      className={`inf-page-btn${currentPage === p ? ' active' : ''}`}
                      onClick={() => setCurrentPage(p as number)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button className="inf-page-btn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} aria-label="Next page">→</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {isDeleteModalOpen && influencerToDelete && (
        <DeleteConfirmationModal
          influencerName={influencerToDelete.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCloseDeleteModal}
        />
      )}
    </>
  );
};

export default Influencers;
