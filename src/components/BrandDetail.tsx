import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getBrands } from '../store/actions/brandAction';

// ── Styles ─────────────────────────────────────────────────────────────────────

const STYLES = `
  .bd-grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; }
  @media (min-width: 640px) { .bd-grid-2 { grid-template-columns: 1fr 1fr; } }
  .bd-grid-3 { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 640px)  { .bd-grid-3 { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .bd-grid-3 { grid-template-columns: repeat(3, 1fr); } }
  .bd-member-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  @media (min-width: 768px)  { .bd-member-grid { grid-template-columns: repeat(2, 1fr); } }
  .bd-hero-layout { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; }
  @media (min-width: 640px) { .bd-hero-layout { flex-direction: row; align-items: flex-start; text-align: left; } }
  .bd-back-btn:hover { opacity: 0.85; }
  .bd-link:hover { text-decoration: underline; }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr.split('T')[0];
  }
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#e1306c', youtube: '#ff0000', tiktok: '#69c9d0',
  twitter: '#1da1f2', x: '#e5e7eb', facebook: '#1877f2',
  linkedin: '#0a66c2', snapchat: '#f9d71c', twitch: '#9146ff',
  pinterest: '#e60023', threads: '#e5e7eb',
};

function platformColor(platform: string): string {
  return PLATFORM_COLORS[platform?.toLowerCase()] ?? '#9ca3af';
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const MailIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth={2} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

const PinIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const LinkedinIcon = () => (
  <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const XSmallIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── Sub-components ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#242736',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 12,
  padding: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  marginBottom: 16,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 4,
};

const fieldValue: React.CSSProperties = {
  fontSize: 14, color: '#e5e7eb',
};

interface StatusPillProps { on: boolean; labelOn: string; labelOff: string; }
const StatusPill: React.FC<StatusPillProps> = ({ on, labelOn, labelOff }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '3px 10px',
    background: on ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
    color: on ? '#10b981' : '#f87171',
    border: `1px solid ${on ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)'}`,
  }}>
    {on ? <CheckIcon /> : <XSmallIcon />}
    {on ? labelOn : labelOff}
  </span>
);

// ── Main component ─────────────────────────────────────────────────────────────

const BrandDetail: React.FC = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const location  = useLocation() as any;
  const dispatch  = useDispatch();
  const brands    = useSelector((state: any) => state.brands);

  const brand = location.state?.brand || (brands?.profiles || brands?.brands || [])?.find((b: any) => b._id === id);

  const savedPage        = location.state?.currentPage || 1;
  const savedItemsPerPage = location.state?.itemsPerPage || 10;

  const handleBack = () => {
    // @ts-ignore
    dispatch(getBrands(savedItemsPerPage, savedPage, '', '', '', '', '', '', '', '', () => {}) as unknown as any);
    navigate('/brands', { state: { currentPage: savedPage, itemsPerPage: savedItemsPerPage } });
  };

  if (!brand) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: '#6b7280' }}>
        Brand not found.
      </div>
    );
  }

  const teamMembers: any[]     = Array.isArray(brand.team_members) ? brand.team_members : [];
  const socialHandles: any[]   = Array.isArray(brand.social_handles) ? brand.social_handles : [];
  const showSubtitle           = brand.name && brand.name !== brand.brand_name;
  const avatarSrc              = brand.profile_image || brand.logo;
  const locationParts          = [capitalize(brand.city), capitalize(brand.state), capitalize(brand.country)].filter(Boolean);

  return (
    <>
      <style>{STYLES}</style>
      <div style={{ margin: '-24px', padding: '24px', minHeight: '100%', background: '#1a1d2e' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f9fafb' }}>Brand Profile</h1>
          <button
            onClick={handleBack}
            className="bd-back-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s ease' }}
          >
            <BackIcon />
            Back to Brands
          </button>
        </div>

        {/* ── HERO CARD ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div className="bd-hero-layout">

            {/* Avatar */}
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={brand.brand_name}
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid #4f46e5' }}
              />
            ) : (
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 28, fontWeight: 700, color: '#fff', border: '3px solid rgba(79,70,229,0.4)' }}>
                {getInitials(brand.brand_name || brand.name)}
              </div>
            )}

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#f9fafb', lineHeight: 1.2 }}>
                {brand.brand_name}
              </h2>
              {showSubtitle && (
                <p style={{ margin: '4px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>{brand.name}</p>
              )}
              {brand.description && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.6, maxWidth: 600 }}>
                  {brand.description}
                </p>
              )}
              {(brand.profile_description && !brand.description) && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.6, maxWidth: 600 }}>
                  {brand.profile_description}
                </p>
              )}

              {/* Status pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                <StatusPill on={!!brand.is_active}            labelOn="Active"           labelOff="Inactive" />
                <StatusPill on={!!brand.is_email_verified}    labelOn="Email Verified"   labelOff="Email Unverified" />
                <StatusPill on={!!brand.is_profile_completed} labelOn="Profile Complete" labelOff="Profile Incomplete" />
                <StatusPill on={!!brand.is_approved_by_admin} labelOn="Admin Approved"   labelOff="Not Approved" />
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTACT + ACCOUNT INFO ── */}
        <div className="bd-grid-2" style={{ marginBottom: 16 }}>

          {/* Contact & Location */}
          <div style={card}>
            <p style={sectionTitle}>Contact &amp; Location</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {brand.email && (
                <div>
                  <p style={fieldLabel}>Email</p>
                  <a href={`mailto:${brand.email}`} className="bd-link" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: '#818cf8', textDecoration: 'none' }}>
                    <MailIcon />
                    {brand.email}
                  </a>
                </div>
              )}

              {brand.website_address && (
                <div>
                  <p style={fieldLabel}>Website</p>
                  <a href={brand.website_address} target="_blank" rel="noopener noreferrer" className="bd-link" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: '#818cf8', textDecoration: 'none' }}>
                    <GlobeIcon />
                    {brand.website_address.replace(/^https?:\/\//, '')}
                    <ExternalLinkIcon />
                  </a>
                </div>
              )}

              {locationParts.length > 0 && (
                <div>
                  <p style={fieldLabel}>Location</p>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 14, color: '#e5e7eb' }}>
                    <span style={{ marginTop: 2, color: '#6b7280', flexShrink: 0 }}><PinIcon /></span>
                    <span>
                      {locationParts.join(', ')}
                      {brand.zip ? ` – ${brand.zip}` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Info */}
          <div style={card}>
            <p style={sectionTitle}>Account Info</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {brand.created_date && (
                <div>
                  <p style={fieldLabel}>Joined</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...fieldValue }}>
                    <span style={{ color: '#6b7280' }}><CalendarIcon /></span>
                    {formatDate(brand.created_date)}
                  </div>
                </div>
              )}

              <div>
                <p style={fieldLabel}>Account ID</p>
                <p style={{ ...fieldValue, fontSize: 12, color: '#6b7280', fontFamily: 'monospace', wordBreak: 'break-all' }}>{brand._id}</p>
              </div>

              <div>
                <p style={fieldLabel}>Status Flags</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {[
                    { label: 'Active',           value: brand.is_active },
                    { label: 'Email Verified',   value: brand.is_email_verified },
                    { label: 'Profile Complete', value: brand.is_profile_completed },
                    { label: 'Admin Approved',   value: brand.is_approved_by_admin },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#9ca3af' }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: value ? '#10b981' : '#f87171' }}>
                        {value ? 'Yes' : 'No'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TEAM MEMBERS ── */}
        {teamMembers.length > 0 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <p style={sectionTitle}>Team Members <span style={{ fontWeight: 400, color: '#4b5563', fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>({teamMembers.length})</span></p>
            <div className="bd-member-grid">
              {teamMembers.map((member: any, idx: number) => {
                const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ') || '—';
                return (
                  <div
                    key={member._id || idx}
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16 }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: member.is_admin ? '#4f46e5' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {getInitials(fullName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fullName}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                          {member.designation || 'Team Member'}
                          {member.is_admin && (
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: 'rgba(79,70,229,0.15)', color: '#818cf8', borderRadius: 8, padding: '2px 7px' }}>Admin</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: member.is_active ? '#10b981' : '#f87171' }}>
                        {member.is_active ? '● Active' : '● Inactive'}
                      </span>
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {member.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#6b7280', flexShrink: 0 }}><MailIcon /></span>
                          <a href={`mailto:${member.email}`} className="bd-link" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.email}
                          </a>
                        </div>
                      )}
                      {member.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#6b7280', flexShrink: 0 }}><PhoneIcon /></span>
                          <span style={{ fontSize: 13, color: '#9ca3af' }}>{member.phone}</span>
                        </div>
                      )}
                      {member.linkedin_profile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#0a66c2', flexShrink: 0 }}><LinkedinIcon /></span>
                          <a href={member.linkedin_profile} target="_blank" rel="noopener noreferrer" className="bd-link" style={{ fontSize: 13, color: '#9ca3af', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                            LinkedIn Profile
                            <ExternalLinkIcon />
                          </a>
                        </div>
                      )}
                      {member.created_date && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#6b7280', flexShrink: 0 }}><CalendarIcon /></span>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>Joined {formatDate(member.created_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SOCIAL HANDLES ── */}
        {socialHandles.length > 0 && (
          <div style={card}>
            <p style={sectionTitle}>Social Handles <span style={{ fontWeight: 400, color: '#4b5563', fontSize: 12, textTransform: 'none', letterSpacing: 0 }}>({socialHandles.length})</span></p>
            <div className="bd-grid-3">
              {socialHandles.map((handle: any, idx: number) => {
                const color = platformColor(handle.platform);
                return (
                  <div
                    key={handle._id || idx}
                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}28`, borderRadius: 10, padding: '14px 16px', opacity: handle.is_active === false ? 0.5 : 1 }}
                  >
                    {/* Platform + active badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color, textTransform: 'capitalize' }}>
                        {handle.platform}
                      </span>
                      {handle.is_active === false && (
                        <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Inactive</span>
                      )}
                    </div>

                    {/* URL */}
                    {handle.url && (
                      <a
                        href={handle.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bd-link"
                        style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#9ca3af', textDecoration: 'none', marginBottom: handle.follower_range ? 8 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        <GlobeIcon />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {handle.url.replace(/^https?:\/\/(www\.)?/, '')}
                        </span>
                        <span style={{ flexShrink: 0 }}><ExternalLinkIcon /></span>
                      </a>
                    )}

                    {/* Follower range */}
                    {handle.follower_range && (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: handle.url ? 6 : 0 }}>
                        <span style={{ fontWeight: 600, color: '#9ca3af' }}>Followers: </span>
                        {handle.follower_range}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty social + team state */}
        {teamMembers.length === 0 && socialHandles.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontSize: 13, padding: '32px 24px' }}>
            No team members or social handles have been added yet.
          </div>
        )}

      </div>
    </>
  );
};

export default BrandDetail;
