import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { getInfluencerStats } from '../store/actions/dashboardAction';
import collabs from '../config/collabs';

// ── Responsive styles injected once ───────────────────────────────────────────

const STYLES = `
  @keyframes dash-shimmer {
    0%   { opacity: 1; }
    50%  { opacity: 0.45; }
    100% { opacity: 1; }
  }
  /* stat grid: 2-col default, 5-col at 1024px */
  .dash-stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  /* When 5 cards wrap to 2-col, prevent the lone last card being half-width */
  @media (max-width: 1023px) {
    .dash-stat-grid > :last-child:nth-child(odd) { grid-column: 1 / -1; }
  }
  @media (min-width: 1024px) {
    .dash-stat-grid { grid-template-columns: repeat(5, 1fr); }
  }
  /* action grid: 1-col default, 2-col at 640px, 4-col at 1024px */
  .dash-action-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 640px) {
    .dash-action-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .dash-action-grid { grid-template-columns: repeat(4, 1fr); }
  }
  /* banner: stack on narrow, row at 480px */
  .dash-banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  /* page header: stack on narrow, row at 480px */
  .dash-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  /* stat sub-label row */
  .dash-section-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
`;

// ── SVG Icons ──────────────────────────────────────────────────────────────────

const UsersIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const ShieldCheckIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UserCheckIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const StarIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Skeleton card ──────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div style={{
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    overflow: 'hidden',
  }}>
    <div style={{ height: 3, background: 'rgba(255,255,255,0.07)' }} />
    <div style={{ padding: '20px 20px 18px' }}>
      <div style={{
        height: 32, width: 68, borderRadius: 6, marginBottom: 10,
        background: 'rgba(255,255,255,0.06)',
        animation: 'dash-shimmer 1.6s ease-in-out infinite',
      }} />
      <div style={{
        height: 10, width: 108, borderRadius: 4, marginBottom: 14,
        background: 'rgba(255,255,255,0.04)',
        animation: 'dash-shimmer 1.6s ease-in-out infinite 0.15s',
      }} />
      <div style={{
        height: 10, width: 76, borderRadius: 4,
        background: 'rgba(255,255,255,0.04)',
        animation: 'dash-shimmer 1.6s ease-in-out infinite 0.3s',
      }} />
    </div>
  </div>
);

// ── Stat card ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | null;
  subValue?: number | null;
  subLabel?: string;
  accentColor: string;
  /** true → amber when > 0, green when 0; false → muted white */
  subColored: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, subValue, subLabel, accentColor, subColored,
}) => {
  const subColor = subColored
    ? ((subValue ?? 0) > 0 ? '#f59e0b' : '#10b981')
    : 'rgba(255,255,255,0.35)';

  return (
    <div style={{
      background: '#111827',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{ height: 3, background: accentColor }} />
      <div style={{ padding: '20px 20px 18px' }}>
        <p style={{
          fontSize: 30, fontWeight: 600,
          color: 'rgba(255,255,255,0.90)',
          lineHeight: 1, margin: '0 0 8px',
        }}>
          {value ?? '—'}
        </p>
        <p style={{
          fontSize: 11, fontWeight: 500,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.42)',
          margin: '0 0 12px',
        }}>
          {label}
        </p>
        {subValue != null && subLabel && (
          <p style={{ fontSize: 12, fontWeight: 500, color: subColor, margin: 0 }}>
            {subValue} {subLabel}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Quick action card ──────────────────────────────────────────────────────────

interface QuickActionCardProps {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
  disabled?: boolean;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  icon, iconColor, title, subtitle, onClick, disabled = false,
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left',
        width: '100%',
        background: hovered ? 'rgba(255,255,255,0.04)' : '#111827',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 20,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: hovered ? 'scale(1.01)' : 'scale(1)',
        transition: 'background 0.15s ease, transform 0.15s ease',
        display: 'block',
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 8, marginBottom: 12,
        background: `${iconColor}1a`, color: iconColor,
      }}>
        {icon}
      </span>
      <p style={{
        fontSize: 14, fontWeight: 600,
        color: 'rgba(255,255,255,0.88)',
        margin: '0 0 4px',
      }}>
        {title}
      </p>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', margin: 0 }}>
        {subtitle}
      </p>
    </button>
  );
};

// ── Dashboard ──────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const influencerStats = useSelector((state: any) => state?.influencerStats?.data);
  const dispatch        = useDispatch();
  const navigate        = useNavigate();

  const [isLoading,     setIsLoading]     = useState(true);
  const [hasError,      setHasError]      = useState(false);
  const [brandCount,    setBrandCount]    = useState<number | null>(null);
  const [brandsLoading, setBrandsLoading] = useState(true);

  const fetchBrandCount = useCallback(async () => {
    setBrandsLoading(true);
    try {
      const res = await collabs.get('/admin/brands/list?page=1&limit=1');
      if (res.data?.success) {
        setBrandCount(res.data?.data?.pagination?.total_count ?? null);
      }
    } catch {
      // fail silently — brands card shows '—'
    } finally {
      setBrandsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    dispatch(
      getInfluencerStats(() => {
        setIsLoading(false);
      }) as unknown as any
    );
  }, [dispatch]);

  useEffect(() => {
    fetchStats();
    fetchBrandCount();
  }, [fetchStats, fetchBrandCount]);

  // Detect silent failure: loading finished but data never arrived
  useEffect(() => {
    if (!isLoading && !influencerStats) setHasError(true);
  }, [isLoading, influencerStats]);

  const pendingCount: number =
    influencerStats?.total_active_influencers_with_complete_profile_and_not_approved_by_admin ?? 0;

  const stats: StatCardProps[] = [
    {
      label:       'Total Influencers',
      value:       influencerStats?.total_influencers ?? 0,
      subValue:    influencerStats?.total_active_influencers ?? 0,
      subLabel:    'Active',
      accentColor: '#4f46e5',
      subColored:  false,
    },
    {
      label:       'Verified Emails',
      value:       influencerStats?.total_active_influencers_with_verified_email ?? 0,
      subValue:    influencerStats?.total_active_influencers_with_unverified_email ?? 0,
      subLabel:    'Unverified',
      accentColor: '#10b981',
      subColored:  true,
    },
    {
      label:       'Profile Completion',
      value:       influencerStats?.total_active_influencers_with_complete_profile ?? 0,
      subValue:    influencerStats?.total_active_influencers_with_incomplete_profile ?? 0,
      subLabel:    'Incomplete',
      accentColor: '#f59e0b',
      subColored:  true,
    },
    {
      label:       'Admin Approved',
      value:       influencerStats?.total_active_influencers_with_complete_profile_and_approved_by_admin ?? 0,
      subValue:    pendingCount,
      subLabel:    pendingCount > 0 ? 'Pending Review' : 'All caught up',
      accentColor: '#7c6edd',
      subColored:  true,
    },
    {
      label:       'Total Brands',
      value:       brandCount,
      accentColor: '#f43f5e',
      subColored:  false,
    },
  ];

  return (
    <>
      <style>{STYLES}</style>

      {/* Page background — extends to fill the parent's padded area */}
      <div style={{
        minHeight: '100%',
        background: '#1f2937',
        margin:  '-24px',
        padding: '24px',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* ── Page header ── */}
          <div className="dash-page-header" style={{
            paddingBottom: 20,
            marginBottom:  24,
            borderBottom:  '1px solid rgba(255,255,255,0.08)',
          }}>
            <h1 style={{
              fontSize: 22, fontWeight: 600,
              color: 'rgba(255,255,255,0.90)',
              margin: 0,
            }}>
              Dashboard
            </h1>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.36)' }}>
              {formatDate()}
            </span>
          </div>

          {/* ── Pending approvals banner — hidden when 0 or loading ── */}
          {!isLoading && pendingCount > 0 && (
            <div className="dash-banner" style={{
              padding:      '14px 16px',
              marginBottom: 28,
              borderRadius: 10,
              background:   'rgba(245,158,11,0.08)',
              border:       '1px solid rgba(245,158,11,0.22)',
              borderLeft:   '3px solid #f59e0b',
            }}>
              <span style={{ color: '#f59e0b', flexShrink: 0, display: 'flex' }}>
                <ClockIcon />
              </span>
              <p style={{
                flex: 1, minWidth: 160,
                fontSize: 13, fontWeight: 500,
                color: 'rgba(255,255,255,0.82)',
                margin: 0,
              }}>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{pendingCount}</span>
                {' '}creator {pendingCount === 1 ? 'profile' : 'profiles'} awaiting your review
              </p>
              <button
                onClick={() => navigate('/influencers?filter=pending')}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.22)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(245,158,11,0.12)')}
                style={{
                  padding:     '7px 16px',
                  borderRadius: 7,
                  background:  'rgba(245,158,11,0.12)',
                  border:      '1px solid rgba(245,158,11,0.30)',
                  color:       '#f59e0b',
                  fontSize:    12,
                  fontWeight:  600,
                  cursor:      'pointer',
                  whiteSpace:  'nowrap',
                  flexShrink:  0,
                  transition:  'background 0.15s ease',
                }}
              >
                Review Now
              </button>
            </div>
          )}

          {/* ── Influencer Overview ── */}
          <div style={{ marginBottom: 32 }}>
            <div className="dash-section-row">
              <p style={{
                fontSize: 11, fontWeight: 600,
                letterSpacing: '0.10em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                margin: 0,
              }}>
                Influencer Overview
              </p>

              {hasError && (
                <button
                  onClick={fetchStats}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.18)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.10)')}
                  style={{
                    display:      'inline-flex',
                    alignItems:   'center',
                    gap:          6,
                    padding:      '5px 12px',
                    borderRadius: 6,
                    background:   'rgba(239,68,68,0.10)',
                    border:       '1px solid rgba(239,68,68,0.22)',
                    color:        '#f87171',
                    fontSize:     12,
                    fontWeight:   500,
                    cursor:       'pointer',
                    transition:   'background 0.15s ease',
                  }}
                >
                  <RefreshIcon />
                  Retry
                </button>
              )}
            </div>

            {hasError && (
              <p style={{
                fontSize: 12,
                color: 'rgba(248,113,113,0.72)',
                margin: '0 0 16px',
              }}>
                Unable to load stats. Check your connection and retry.
              </p>
            )}

            <div className="dash-stat-grid">
              {(isLoading || brandsLoading)
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
                : stats.map(s => <StatCard key={s.label} {...s} />)
              }
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div>
            <p style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: '0.10em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              margin: '0 0 14px',
            }}>
              Quick Actions
            </p>
            <div className="dash-action-grid">
              <QuickActionCard
                icon={<UserCheckIcon />}
                iconColor="#4f46e5"
                title="Review Creators"
                subtitle="Approve or reject pending profiles"
                onClick={() => navigate('/influencers')}
              />
              <QuickActionCard
                icon={<BuildingIcon />}
                iconColor="#10b981"
                title="Manage Brands"
                subtitle="View and manage brand accounts"
                onClick={() => navigate('/brands')}
              />
              <QuickActionCard
                icon={<StarIcon />}
                iconColor="#f59e0b"
                title="Featured Creators"
                subtitle="Coming soon"
                disabled
              />
              <QuickActionCard
                icon={(
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                iconColor="#06b6d4"
                title="Insights"
                subtitle="Platform analytics & trends"
                onClick={() => navigate('/insights')}
              />
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default Dashboard;
