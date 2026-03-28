import React, { useState, useMemo, useEffect, useRef } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { getBrands, deleteBrand } from '../store/actions/brandAction';
import { getCountries, getStates, getCities } from '../store/actions/globalActions';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

// ── Styles ─────────────────────────────────────────────────────────────────────

const STYLES = `
  @keyframes br-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .br-shimmer {
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    animation: br-shimmer 1.5s ease-in-out infinite;
    border-radius: 6px;
  }
  .br-filter-panel { max-height: 0; overflow: hidden; transition: max-height 0.35s ease; }
  .br-filter-panel.open { max-height: 600px; }
  .br-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (min-width: 768px)  { .br-filter-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1024px) { .br-filter-grid { grid-template-columns: repeat(6, 1fr); } }
  .br-card-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 640px)  { .br-card-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .br-card-grid { grid-template-columns: repeat(3, 1fr); } }
  .br-table-wrap { overflow-x: auto; }
  .br-tr:hover td { background: rgba(255,255,255,0.025) !important; }
  .br-card { transition: background 0.15s ease, transform 0.15s ease, border-color 0.15s ease; }
  .br-card:hover { background: rgba(255,255,255,0.05) !important; transform: scale(1.005); border-color: rgba(255,255,255,0.14) !important; }
  .br-select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 32px !important;
  }
  .br-select option { background: #1e2130; color: #e5e7eb; }
  .br-input:focus, .br-select:focus {
    outline: none;
    border-color: #4f46e5 !important;
    box-shadow: 0 0 0 2px rgba(79,70,229,0.2);
  }
  .br-search-wrap { position: relative; width: 100%; }
  @media (min-width: 640px) { .br-search-wrap { width: 280px; } }
  .br-page-btn {
    min-width: 32px; height: 32px; padding: 0 8px; border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #9ca3af;
    font-size: 13px; cursor: pointer; transition: all 0.15s ease;
    display: flex; align-items: center; justify-content: center;
  }
  .br-page-btn:hover:not(:disabled):not(.active) { background: rgba(255,255,255,0.06); color: #e5e7eb; }
  .br-page-btn.active  { background: #4f46e5; border-color: #4f46e5; color: #fff; }
  .br-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatJoinDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr.split('T')[0];
  }
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

const TrashIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

const PinIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// ── StatusBadge ────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let bg = '', color = '', border = '';
  switch (status) {
    case 'Complete':
      bg = 'rgba(16,185,129,0.1)'; color = '#10b981'; border = 'rgba(16,185,129,0.2)'; break;
    case 'Incomplete':
      bg = 'rgba(245,158,11,0.1)'; color = '#f59e0b'; border = 'rgba(245,158,11,0.2)'; break;
    default:
      bg = 'rgba(156,163,175,0.1)'; color = '#9ca3af'; border = 'rgba(156,163,175,0.2)';
  }
  return (
    <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 20, fontSize: 11, fontWeight: 600, padding: '3px 10px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {status}
    </span>
  );
};

// ── Skeleton components ────────────────────────────────────────────────────────

const SkeletonTableRow: React.FC = () => (
  <tr>
    {[190, 140, 90, 110, 70, 80, 60].map((w, i) => (
      <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="br-shimmer" style={{ height: 12, width: w }} />
      </td>
    ))}
  </tr>
);

const SkeletonCard: React.FC = () => (
  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <div className="br-shimmer" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="br-shimmer" style={{ height: 13, width: '58%', marginBottom: 7 }} />
        <div className="br-shimmer" style={{ height: 10, width: '38%' }} />
      </div>
    </div>
    <div className="br-shimmer" style={{ height: 10, width: '45%', marginBottom: 8 }} />
    <div className="br-shimmer" style={{ height: 10, width: '60%', marginBottom: 14 }} />
    <div className="br-shimmer" style={{ height: 10, width: '70%', marginBottom: 14 }} />
    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
      <div className="br-shimmer" style={{ height: 28, width: 64, borderRadius: 6 }} />
      <div className="br-shimmer" style={{ height: 28, width: 64, borderRadius: 6 }} />
    </div>
  </div>
);

// ── Empty state ────────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ hasFilters: boolean; onClear: () => void }> = ({ hasFilters, onClear }) => (
  <div style={{ textAlign: 'center', padding: '60px 24px', color: '#9ca3af' }}>
    <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
    <p style={{ fontSize: 16, fontWeight: 600, color: '#e5e7eb', margin: '0 0 8px' }}>No brands found</p>
    <p style={{ fontSize: 13, margin: '0 0 20px', color: '#6b7280' }}>
      {hasFilters ? 'No results match your current filters.' : 'No brands have signed up yet.'}
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

// ── Debounce hook ──────────────────────────────────────────────────────────────

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// ── Main component ─────────────────────────────────────────────────────────────

const Brands: React.FC = () => {
  const dispatch  = useDispatch();
  const brands    = useSelector((state: any) => state.brands);
  const locations = useSelector((state: any) => state.locationsRed);
  const navigate  = useNavigate();
  const location  = useLocation() as any;

  const [searchQuery,        setSearchQuery]        = useState('');
  const [currentPage,        setCurrentPage]        = useState(location.state?.currentPage || 1);
  const [itemsPerPage,       setItemsPerPage]       = useState(location.state?.itemsPerPage || 10);
  const [isDeleteModalOpen,  setDeleteModalOpen]    = useState(false);
  const [brandToDelete,      setBrandToDelete]      = useState<any | null>(null);
  const [isLoading,          setIsLoading]          = useState(true);
  const [view,               setView]               = useState<'table' | 'cards'>('table');
  const [showFilters,        setShowFilters]        = useState(false);
  const isRestoringFromNavigation = useRef(false);

  const [filters, setFilters] = useState({
    is_active:            '',
    is_email_verified:    '',
    is_profile_completed: '',
    country:              '',
    state:                '',
    city:                 '',
  });

  const [countryId, setCountryId] = useState('');
  const [stateId,   setStateId]   = useState('');
  const [cityId,    setCityId]    = useState('');

  const debouncedCountry = useDebounce(filters.country, 500);
  const debouncedState   = useDebounce(filters.state,   500);
  const debouncedCity    = useDebounce(filters.city,    500);

  const activeFilterCount = useMemo(() =>
    Object.values(filters).filter(v => v !== '').length,
  [filters]);

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
    setFilters({ is_active: '', is_email_verified: '', is_profile_completed: '', country: '', state: '', city: '' });
    setCountryId(''); setStateId(''); setCityId('');
    setSearchQuery(''); setCurrentPage(1);
  };

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
    dispatch(getBrands(
      itemsPerPage, currentPage,
      filters.is_active, filters.is_email_verified, filters.is_profile_completed,
      '', '', // is_approved_by_admin, is_featured — not sent
      debouncedCountry, debouncedState, debouncedCity,
      '', // gender — not sent
      (_success: boolean) => { setIsLoading(false); }
    ) as unknown as any);
  }, [
    dispatch, itemsPerPage, currentPage,
    filters.is_active, filters.is_email_verified, filters.is_profile_completed,
    debouncedCountry, debouncedState, debouncedCity,
  ]);

  useEffect(() => {
    if (!isRestoringFromNavigation.current) setCurrentPage(1);
  }, [searchQuery]);

  // ── Derived ──

  const brandsList = brands?.profiles || brands?.brands || [];

  const filteredBrands = useMemo(() => {
    if (!Array.isArray(brandsList)) return [];
    if (!searchQuery) return brandsList;
    const q = searchQuery.toLowerCase();
    return brandsList.filter((b: any) =>
      b.brand_name?.toLowerCase().includes(q) || b.name?.toLowerCase().includes(q)
    );
  }, [brandsList, searchQuery]);

  const totalCount = brands?.pagination?.total_count ?? 0;
  const totalPages = totalCount ? Math.ceil(totalCount / itemsPerPage) : 1;
  const showStart  = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showEnd    = Math.min(currentPage * itemsPerPage, totalCount);
  const pageRange  = getPageRange(currentPage, totalPages);

  // ── Action handlers ──

  const handleViewProfile = (brand: any) => {
    navigate(`/brands/${brand._id}`, { state: { brand, currentPage, itemsPerPage } });
  };

  const handleOpenDeleteModal  = (brand: any) => { setBrandToDelete(brand); setDeleteModalOpen(true); };
  const handleCloseDeleteModal = () => { setBrandToDelete(null); setDeleteModalOpen(false); };
  const handleConfirmDelete    = () => {
    if (brandToDelete) {
      dispatch(deleteBrand(brandToDelete._id, (success: boolean) => {
        if (success) {
          dispatch(getBrands(
            itemsPerPage, currentPage,
            filters.is_active, filters.is_email_verified, filters.is_profile_completed,
            '', '', debouncedCountry, debouncedState, debouncedCity, '', () => {}
          ) as unknown as any);
        }
        handleCloseDeleteModal();
      }) as unknown as any);
    }
  };

  // ── Shared styles ──

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

  const iconBtnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', cursor: 'pointer', transition: 'all 0.15s ease',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ margin: '-24px', padding: '24px', minHeight: '100%', background: '#1a1d2e' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f9fafb', lineHeight: 1.3 }}>Brands</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
              {totalCount > 0 ? `${totalCount.toLocaleString()} brands` : 'Manage brand accounts'}
            </p>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {(['table', 'cards'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', border: 'none',
                  background: view === v ? '#4f46e5' : 'transparent',
                  color: view === v ? '#fff' : '#6b7280',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s ease',
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
          <div className="br-search-wrap">
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none', display: 'flex' }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by brand or name…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="br-input"
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
              cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s ease',
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
        <div className={`br-filter-panel${showFilters ? ' open' : ''}`}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '16px 16px 12px', marginBottom: 16 }}>
            <div className="br-filter-grid">

              <div>
                <label style={labelStyle}>Account Status</label>
                <select className="br-select" value={filters.is_active} onChange={e => handleFilterChange('is_active', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Email Verified</label>
                <select className="br-select" value={filters.is_email_verified} onChange={e => handleFilterChange('is_email_verified', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Verified</option>
                  <option value="0">Unverified</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Profile Completed</label>
                <select className="br-select" value={filters.is_profile_completed} onChange={e => handleFilterChange('is_profile_completed', e.target.value)} style={fieldStyle}>
                  <option value="">All</option>
                  <option value="1">Complete</option>
                  <option value="0">Incomplete</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Country</label>
                <select className="br-select" value={countryId} onChange={e => handleCountryChange(e.target.value)} style={fieldStyle}>
                  <option value="">All Countries</option>
                  {locations?.countries?.countries?.map((c: any) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>State</label>
                <select className="br-select" value={stateId} onChange={e => handleStateChange(e.target.value)} disabled={!countryId} style={{ ...fieldStyle, opacity: countryId ? 1 : 0.4, cursor: countryId ? 'default' : 'not-allowed' }}>
                  <option value="">All States</option>
                  {locations?.states?.country?.states?.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>City</label>
                <select className="br-select" value={cityId} onChange={e => handleCityChange(e.target.value)} disabled={!stateId} style={{ ...fieldStyle, opacity: stateId ? 1 : 0.4, cursor: stateId ? 'default' : 'not-allowed' }}>
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
            <div className="br-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Brand', 'Email', 'Phone', 'Location', 'Profile', 'Joined', 'Action'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', background: '#242736' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => <SkeletonTableRow key={i} />)
                  ) : filteredBrands.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState hasFilters={activeFilterCount > 0 || !!searchQuery} onClear={clearFilters} />
                      </td>
                    </tr>
                  ) : (
                    filteredBrands.map((brand: any) => {
                      const showSubtitle = brand.name && brand.name !== brand.brand_name;
                      const phone = brand.team_members?.[0]?.phone;
                      const location_str = [capitalize(brand.city), capitalize(brand.country)].filter(Boolean).join(', ') || '—';
                      const avatarSrc = brand.profile_image || brand.logo;
                      return (
                        <tr key={brand._id} className="br-tr" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {/* Brand */}
                          <td style={{ padding: '12px 16px', minWidth: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {avatarSrc ? (
                                <img src={avatarSrc} alt={brand.brand_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: '#374151' }} />
                              ) : (
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff' }}>
                                  {getInitials(brand.brand_name || brand.name)}
                                </div>
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: '#f9fafb', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                                  {brand.brand_name}
                                </div>
                                {showSubtitle && (
                                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                                    {brand.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Email */}
                          <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>{brand.email || '—'}</td>
                          {/* Phone */}
                          <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{phone || '—'}</td>
                          {/* Location */}
                          <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{location_str}</td>
                          {/* Profile */}
                          <td style={{ padding: '12px 16px' }}>
                            <StatusBadge status={brand.is_profile_completed ? 'Complete' : 'Incomplete'} />
                          </td>
                          {/* Joined */}
                          <td style={{ padding: '12px 16px', color: '#9ca3af', whiteSpace: 'nowrap', fontSize: 12 }}>
                            {formatJoinDate(brand.created_date)}
                          </td>
                          {/* Action */}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                onClick={() => handleViewProfile(brand)}
                                style={{ ...iconBtnBase, color: '#9ca3af' }}
                                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(79,70,229,0.15)'; b.style.color = '#818cf8'; b.style.borderColor = '#4f46e5'; }}
                                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = '#9ca3af'; b.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                aria-label="View brand"
                              >
                                <EyeIcon />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteModal(brand)}
                                style={{ ...iconBtnBase, color: 'rgba(255,255,255,0.3)' }}
                                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(239,68,68,0.1)'; b.style.color = '#f87171'; b.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = 'rgba(255,255,255,0.3)'; b.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                                aria-label="Delete brand"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── CARD VIEW ── */}
          {view === 'cards' && (
            <div style={{ padding: 20 }}>
              {isLoading ? (
                <div className="br-card-grid">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : filteredBrands.length === 0 ? (
                <EmptyState hasFilters={activeFilterCount > 0 || !!searchQuery} onClear={clearFilters} />
              ) : (
                <div className="br-card-grid">
                  {filteredBrands.map((brand: any) => {
                    const showSubtitle = brand.name && brand.name !== brand.brand_name;
                    const phone = brand.team_members?.[0]?.phone;
                    const location_str = [capitalize(brand.city), capitalize(brand.country)].filter(Boolean).join(', ');
                    const avatarSrc = brand.profile_image || brand.logo;
                    return (
                      <div
                        key={brand._id}
                        className="br-card"
                        style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: 16, display: 'flex', flexDirection: 'column', gap: 0 }}
                      >
                        {/* Top row: avatar + name + badge */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                          {avatarSrc ? (
                            <img src={avatarSrc} alt={brand.brand_name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15, fontWeight: 700, color: '#fff' }}>
                              {getInitials(brand.brand_name || brand.name)}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#f9fafb', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {brand.brand_name}
                            </div>
                            {showSubtitle && (
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                                {brand.name}
                              </div>
                            )}
                          </div>
                          <StatusBadge status={brand.is_profile_completed ? 'Complete' : 'Incomplete'} />
                        </div>

                        {/* Location + joined */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            <PinIcon />
                            <span>{location_str || 'Location unknown'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            <CalendarIcon />
                            <span>{formatJoinDate(brand.created_date)}</span>
                          </div>
                        </div>

                        {/* Email */}
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 14 }}>
                          {brand.email || '—'}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 'auto' }}>
                          <button
                            onClick={() => handleViewProfile(brand)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease' }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(79,70,229,0.15)'; b.style.color = '#818cf8'; b.style.borderColor = '#4f46e5'; }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = '#9ca3af'; b.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                            aria-label="View brand"
                          >
                            <EyeIcon />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(brand)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', height: 30, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease' }}
                            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'rgba(239,68,68,0.1)'; b.style.color = '#f87171'; b.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = 'transparent'; b.style.color = 'rgba(255,255,255,0.3)'; b.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                            aria-label="Delete brand"
                          >
                            <TrashIcon />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PAGINATION ── */}
          {!isLoading && filteredBrands.length > 0 && (
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
                    className="br-select"
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
                <button className="br-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} aria-label="Previous page">←</button>
                {pageRange.map((p, i) =>
                  p === 'gap' ? (
                    <span key={`gap-${i}`} style={{ color: '#6b7280', fontSize: 13, padding: '0 4px', userSelect: 'none' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      className={`br-page-btn${currentPage === p ? ' active' : ''}`}
                      onClick={() => setCurrentPage(p as number)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button className="br-page-btn" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} aria-label="Next page">→</button>
              </div>
            </div>
          )}

        </div>
      </div>

      {isDeleteModalOpen && brandToDelete && (
        <DeleteConfirmationModal
          influencerName={brandToDelete.name}
          onConfirm={handleConfirmDelete}
          onCancel={handleCloseDeleteModal}
        />
      )}
    </>
  );
};

export default Brands;
