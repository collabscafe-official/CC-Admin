import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── API config ────────────────────────────────────────────────────────────────
const EMAIL_SERVICE_URL = 'https://emailapi.collabscafe.com';
const EMAIL_API_KEY = 'FHsbN6M6xc8g';

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

interface PreviewResult {
  success: boolean;
  count: number;
  sample: Array<{ name: string; email: string }>;
}

interface SegFilters {
  profileCompleted: '' | 'true' | 'false';
  emailVerified: '' | 'true' | 'false';
  approvalStatus: '' | 'true' | 'false';
  gender: string;
  country: string;
}

// ── Template defaults (fallback if API unreachable) ───────────────────────────
const TEMPLATE_DEFAULTS: Record<string, string> = {
  incomplete_profile: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Complete Your Profile</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #079f82 0%, #7c6edd 100%); padding: 40px 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .body { padding: 36px 32px; }
    .body p { margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6; }
    .cta { display: block; width: fit-content; margin: 28px auto 0; background: linear-gradient(135deg, #079f82, #7c6edd); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; }
    .footer { padding: 24px 32px; text-align: center; background: #f9fafb; border-top: 1px solid #f0f0f0; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; }
    .footer a { color: #079f82; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Complete Your Profile</h1></div>
    <div class="body">
      <p>Hi {{first_name}},</p>
      <p>Your Collabscafe profile is almost there! Brands browsing our platform are more likely to reach out to creators with complete profiles — so don't miss out.</p>
      <p>Adding your bio, social handles, portfolio, and pricing only takes a few minutes and dramatically increases your chances of getting discovered.</p>
      <a href="{{profile_url}}" class="cta">Complete My Profile</a>
    </div>
    <div class="footer"><p>You're receiving this because you have an account on <a href="https://collabscafe.com">Collabscafe</a>.<br /><a href="https://collabscafe.com/unsubscribe?email={{email}}">Unsubscribe</a></p></div>
  </div>
</body>
</html>`,

  unverified_email: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #079f82 0%, #7c6edd 100%); padding: 40px 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .body { padding: 36px 32px; }
    .body p { margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6; }
    .notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 6px; margin: 0 0 20px; }
    .notice p { margin: 0; color: #92400e; font-size: 14px; }
    .cta { display: block; width: fit-content; margin: 28px auto 0; background: linear-gradient(135deg, #079f82, #7c6edd); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; }
    .footer { padding: 24px 32px; text-align: center; background: #f9fafb; border-top: 1px solid #f0f0f0; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; }
    .footer a { color: #079f82; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Please Verify Your Email</h1></div>
    <div class="body">
      <p>Hi {{first_name}},</p>
      <div class="notice"><p>Your email address hasn't been verified yet. Some features are limited until you verify.</p></div>
      <p>Verifying your email helps brands trust your profile and ensures you receive important notifications about collaboration requests.</p>
      <p>Click the button below to verify your email address and unlock your full profile.</p>
      <a href="{{profile_url}}" class="cta">Verify My Email</a>
    </div>
    <div class="footer"><p>You're receiving this because you have an account on <a href="https://collabscafe.com">Collabscafe</a>.<br /><a href="https://collabscafe.com/unsubscribe?email={{email}}">Unsubscribe</a></p></div>
  </div>
</body>
</html>`,

  inactivity: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>We Miss You</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #079f82 0%, #7c6edd 100%); padding: 40px 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .body { padding: 36px 32px; }
    .body p { margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6; }
    .highlight { background: #f0fdf9; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px; }
    .highlight p { margin: 0; color: #065f46; font-size: 14px; }
    .cta { display: block; width: fit-content; margin: 28px auto 0; background: linear-gradient(135deg, #079f82, #7c6edd); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; }
    .footer { padding: 24px 32px; text-align: center; background: #f9fafb; border-top: 1px solid #f0f0f0; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; }
    .footer a { color: #079f82; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>We Miss You, {{first_name}}!</h1>
      <p>Brands are looking for creators like you</p>
    </div>
    <div class="body">
      <p>Hi {{first_name}},</p>
      <p>It's been a while since we've seen you on Collabscafe. A lot has happened since your last visit — new brands, new campaigns, and new collaboration opportunities are waiting for you.</p>
      <div class="highlight"><p>Your profile is still live and brands can discover you. Log back in to check your messages and update your availability.</p></div>
      <p>Don't let your hard work go unnoticed. Come back and see what's new.</p>
      <a href="{{profile_url}}" class="cta">Go to My Profile</a>
    </div>
    <div class="footer"><p>You're receiving this because you have an account on <a href="https://collabscafe.com">Collabscafe</a>.<br /><a href="https://collabscafe.com/unsubscribe?email={{email}}">Unsubscribe</a></p></div>
  </div>
</body>
</html>`,

  custom_all: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Message from Collabscafe</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #079f82 0%, #7c6edd 100%); padding: 40px 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .body { padding: 36px 32px; color: #374151; font-size: 15px; line-height: 1.6; }
    .footer { padding: 24px 32px; text-align: center; background: #f9fafb; border-top: 1px solid #f0f0f0; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; }
    .footer a { color: #079f82; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>Message from Collabscafe</h1></div>
    <div class="body">{{custom_body}}</div>
    <div class="footer"><p>You're receiving this because you have an account on <a href="https://collabscafe.com">Collabscafe</a>.<br /><a href="https://collabscafe.com/unsubscribe?email={{email}}">Unsubscribe</a></p></div>
  </div>
</body>
</html>`,
};
TEMPLATE_DEFAULTS.custom_segment = TEMPLATE_DEFAULTS.custom_all;

// ── Static config ─────────────────────────────────────────────────────────────
const CAMPAIGN_TYPES = [
  { id: 'incomplete_profile', icon: '📋', title: 'Incomplete Profile',    sub: "Creators who haven't completed their profile" },
  { id: 'unverified_email',   icon: '✉️', title: 'Unverified Email',      sub: "Creators who haven't verified their email" },
  { id: 'inactivity',         icon: '💤', title: 'Inactivity Nudge',      sub: 'Signed up 7+ days ago, never completed profile' },
  { id: 'custom_all',         icon: '📢', title: 'Custom — All Creators', sub: 'Send to all active creators' },
  { id: 'custom_segment',     icon: '🎯', title: 'Custom — Segment',      sub: 'Filter creators by specific criteria' },
];

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

const INSERT_VARS = [
  { key: '{{first_name}}',  label: "Creator's first name" },
  { key: '{{email}}',       label: "Creator's email" },
  { key: '{{profile_url}}', label: 'Profile URL' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function toTemplateType(t: string): string {
  if (t === 'incomplete_profile') return 'incomplete-profile';
  if (t === 'unverified_email')   return 'unverified-email';
  if (t === 'inactivity')         return 'inactivity';
  return 'custom';
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function apiHeaders(json = false) {
  const h: Record<string, string> = { 'x-api-key': EMAIL_API_KEY };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function buildPreview(html: string): string {
  return html
    .replace(/\{\{\s*first_name\s*\}\}/gi, 'Mudassir')
    .replace(/\{\{\s*email\s*\}\}/gi, 'mudassir@collabscafe.com')
    .replace(/\{\{\s*profile_url\s*\}\}/gi, 'https://creator.collabscafe.com')
    .replace(/\{\{\s*custom_body\s*\}\}/gi, '<p>Your custom email content will appear here.</p>')
    .replace(/\{\{\s*\w+\s*\}\}/g, '');
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes ec-spin  { to { transform: rotate(360deg); } }
  @keyframes ec-pulse { 0%,100%{ opacity:1; } 50%{ opacity:0.35; } }
  @keyframes ec-toast { from { transform:translateY(12px); opacity:0; } to { transform:translateY(0); opacity:1; } }

  .ec-layout { display:grid; grid-template-columns:1fr; gap:20px; }
  @media(min-width:1024px){ .ec-layout{ grid-template-columns:2fr 3fr; align-items:start; } }

  .ec-type-grid { display:grid; grid-template-columns:1fr; gap:8px; }
  @media(min-width:480px){ .ec-type-grid{ grid-template-columns:1fr 1fr; } }

  .ec-filter-grid { display:grid; grid-template-columns:1fr; gap:10px; }
  @media(min-width:640px){ .ec-filter-grid{ grid-template-columns:1fr 1fr; } }

  .ec-card {
    background:#111827;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:12px; padding:20px;
  }

  .ec-type-card {
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; padding:12px;
    cursor:pointer; transition:all 0.15s ease;
    background:rgba(255,255,255,0.03);
    text-align:left; width:100%; box-sizing:border-box;
  }
  .ec-type-card:hover { background:rgba(255,255,255,0.07); }
  .ec-type-card.sel   { border-color:#4f46e5; background:rgba(79,70,229,0.1); }

  .ec-input {
    width:100%; background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; padding:10px 12px;
    color:white; font-size:14px; outline:none;
    transition:border-color 0.15s ease; box-sizing:border-box;
  }
  .ec-input:focus { border-color:rgba(79,70,229,0.7); }
  .ec-input::placeholder { color:rgba(255,255,255,0.28); }

  .ec-select {
    width:100%; background:#1a2235;
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; padding:10px 12px;
    color:white; font-size:14px; outline:none;
    cursor:pointer; box-sizing:border-box; appearance:none;
  }

  .ec-btn {
    border:none; border-radius:8px;
    padding:9px 16px; font-size:13px; font-weight:500;
    cursor:pointer; transition:opacity 0.15s ease;
    display:inline-flex; align-items:center; gap:6px;
  }
  .ec-btn:disabled { opacity:0.38; cursor:not-allowed; }
  .ec-btn-primary   { background:#4f46e5; color:white; }
  .ec-btn-secondary { background:#10b981; color:white; }
  .ec-btn-amber     { background:#f59e0b; color:white; }
  .ec-btn-gray      { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); }
  .ec-btn-outline   { background:transparent; color:#4f46e5; border:1px solid #4f46e5; }
  .ec-btn:hover:not(:disabled) { opacity:0.82; }
  .ec-btn-outline:hover:not(:disabled) { background:rgba(79,70,229,0.1); opacity:1; }

  .ec-btn-send {
    background:linear-gradient(to right,#079f82,#7c6edd);
    color:white; border:none; border-radius:8px;
    height:44px; font-size:14px; font-weight:600;
    cursor:pointer; width:100%; transition:opacity 0.15s ease;
  }
  .ec-btn-send:hover:not(:disabled) { opacity:0.85; }
  .ec-btn-send:disabled { opacity:0.32; cursor:not-allowed; }

  .ec-spinner {
    width:15px; height:15px;
    border:2px solid rgba(255,255,255,0.2);
    border-top-color:white; border-radius:50%;
    animation:ec-spin 0.7s linear infinite; display:inline-block; flex-shrink:0;
  }

  .ec-dot-pulse {
    width:7px; height:7px; border-radius:50%;
    animation:ec-pulse 1.4s ease-in-out infinite; flex-shrink:0;
  }

  .ec-progress-bar {
    width:100%; height:6px;
    background:rgba(255,255,255,0.08);
    border-radius:3px; overflow:hidden;
  }
  .ec-progress-fill {
    height:100%;
    background:linear-gradient(to right,#4f46e5,#10b981);
    border-radius:3px; transition:width 0.5s ease;
  }

  .ec-campaign-card {
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:10px; padding:14px 16px;
    margin-bottom:8px; transition:border-color 0.15s ease;
  }
  .ec-campaign-card:hover { border-color:rgba(255,255,255,0.14); }

  .ec-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 9px; border-radius:20px; font-size:11px; font-weight:600;
  }

  .ec-collapsible { overflow:hidden; transition:max-height 0.28s ease; }
  .ec-collapsible.open   { max-height:500px; }
  .ec-collapsible.closed { max-height:0; }

  .ec-toast {
    position:fixed; bottom:24px; right:24px; z-index:10000;
    padding:12px 20px; border-radius:8px;
    font-size:13px; font-weight:500;
    animation:ec-toast 0.22s ease;
    box-shadow:0 4px 20px rgba(0,0,0,0.4); max-width:320px;
  }

  .ec-backdrop {
    position:fixed; inset:0; background:rgba(0,0,0,0.72);
    z-index:1000; display:flex; align-items:center;
    justify-content:center; padding:16px; box-sizing:border-box;
  }
  .ec-modal {
    background:#111827; border:1px solid rgba(255,255,255,0.1);
    border-radius:14px; width:100%; max-width:460px;
    padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.6);
  }

  /* Insert Var dropdown */
  .ec-var-dropdown {
    position:absolute; right:0; top:calc(100% + 6px);
    background:#1a2235; border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; min-width:220px; z-index:10001;
    box-shadow:0 8px 24px rgba(0,0,0,0.4); overflow:hidden;
  }
  .ec-var-item {
    display:flex; align-items:center; justify-content:space-between;
    padding:9px 14px; cursor:pointer; transition:background 0.1s ease;
    border:none; width:100%; background:transparent; text-align:left;
  }
  .ec-var-item:hover { background:rgba(255,255,255,0.06); }

  /* Template trigger row */
  .ec-template-row {
    display:flex; align-items:center; justify-content:space-between;
    gap:12px; padding:14px 16px;
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px;
  }

  /* ── Editor Modal ── */
  .ec-emod-overlay {
    position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9998;
  }
  .ec-emod {
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%);
    width:1200px; max-width:95vw; height:85vh;
    background:#111827; border-radius:16px;
    border:1px solid rgba(255,255,255,0.1);
    display:flex; flex-direction:column; overflow:hidden;
    z-index:9999; box-shadow:0 20px 80px rgba(0,0,0,0.7);
  }
  .ec-emod-header {
    height:56px; padding:0 20px; flex-shrink:0;
    border-bottom:1px solid rgba(255,255,255,0.1);
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    box-sizing:border-box;
  }
  .ec-emod-unsaved {
    background:rgba(245,158,11,0.08);
    border-bottom:1px solid rgba(245,158,11,0.25);
    padding:10px 20px; flex-shrink:0;
    display:flex; align-items:center; justify-content:space-between; gap:12px;
  }
  .ec-emod-body {
    display:flex; flex:1; overflow:hidden;
  }
  .ec-emod-left {
    width:45%; background:#0d1117;
    border-right:1px solid rgba(255,255,255,0.1);
    display:flex; flex-direction:column; overflow:hidden;
  }
  .ec-emod-right {
    flex:1; background:#f4f4f5; display:flex; flex-direction:column;
  }
  .ec-emod-ebar {
    height:32px; background:#161b22; flex-shrink:0;
    border-bottom:1px solid rgba(255,255,255,0.1);
    padding:0 12px; display:flex; align-items:center; gap:8px;
    font-size:11px; color:rgba(255,255,255,0.3);
  }
  .ec-emod-pbar {
    height:32px; background:#e5e7eb; flex-shrink:0;
    border-bottom:1px solid #d1d5db;
    padding:0 12px; display:flex; align-items:center;
    justify-content:space-between; font-size:11px; color:#6b7280;
  }
  .ec-emod-textarea {
    flex:1; background:transparent; color:#e6edf3;
    font-family:'Courier New',Consolas,monospace;
    font-size:13px; line-height:1.6; padding:16px;
    border:none; outline:none; resize:none;
    width:100%; box-sizing:border-box;
  }
  .ec-emod-iframe-wrap {
    flex:1; overflow-y:auto; padding:20px;
    display:flex; align-items:flex-start; justify-content:center;
    background:#f4f4f5;
  }
  .ec-emod-pill {
    height:30px; padding:0 14px; border-radius:6px;
    border:1px solid rgba(255,255,255,0.1); cursor:pointer;
    font-size:12px; font-weight:500; background:transparent;
    display:inline-flex; align-items:center; gap:5px; transition:all 0.15s;
  }
  .ec-emod-pill.active   { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); }
  .ec-emod-pill.inactive { color:rgba(255,255,255,0.4); }
  .ec-emod-pill:hover    { color:rgba(255,255,255,0.8); }
  .ec-emod-desktop-ctrl { display:flex; gap:4px; }
  .ec-emod-mob-tabs     { display:none; }

  @media(max-width:767px) {
    .ec-emod {
      width:100vw; max-width:100vw; height:100vh;
      border-radius:0; top:0; left:0; transform:none;
    }
    .ec-emod-body { flex-direction:column; }
    .ec-emod-left { width:100%; border-right:none; }
    .ec-emod-panel-hidden { display:none !important; }
    .ec-emod-desktop-ctrl { display:none; }
    .ec-emod-mob-tabs { display:flex; gap:0; }
  }
  @media(min-width:768px) and (max-width:1199px) {
    .ec-emod { width:95vw; height:90vh; }
    .ec-emod-left { width:50%; }
  }

  .ec-mob-tab {
    flex:1; background:none; border:none;
    border-bottom:2px solid transparent;
    padding:10px; font-size:13px; font-weight:500;
    color:rgba(255,255,255,0.4); cursor:pointer;
    transition:all 0.15s ease;
  }
  .ec-mob-tab.active { color:#818cf8; border-bottom-color:#4f46e5; }

  /* ── Recipient List ── */
  .ec-recip {
    margin-top:12px; background:#1f2937;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden;
  }
  .ec-recip-hdr {
    padding:10px 14px; display:flex; align-items:center;
    justify-content:space-between; flex-wrap:wrap; gap:8px;
    border-bottom:1px solid rgba(255,255,255,0.08);
  }
  .ec-recip-table { width:100%; border-collapse:collapse; }
  .ec-recip-table th {
    padding:7px 10px; font-size:11px; font-weight:600;
    color:rgba(255,255,255,0.35); text-align:left;
    border-bottom:1px solid rgba(255,255,255,0.07);
  }
  .ec-recip-table td {
    height:40px; padding:0 10px; font-size:13px;
    border-bottom:1px solid rgba(255,255,255,0.04);
    vertical-align:middle;
  }
  .ec-recip-table tr:hover td { background:rgba(255,255,255,0.03); }
  .ec-recip-table tr.excluded td { opacity:0.4; }
  .ec-recip-pager {
    padding:10px 14px; display:flex; align-items:center;
    justify-content:center; gap:12px; font-size:12px;
    color:rgba(255,255,255,0.45); border-top:1px solid rgba(255,255,255,0.07);
  }

  /* ── Rich Text Toolbar ── */
  .ec-rich-toolbar {
    background:#1a2235; flex-shrink:0;
    border-bottom:1px solid rgba(255,255,255,0.08);
    padding:4px 8px; display:flex; align-items:center;
    gap:2px; flex-wrap:wrap;
  }
  .ec-rich-btn {
    width:28px; height:28px; border-radius:4px;
    display:inline-flex; align-items:center; justify-content:center;
    background:none; border:none; cursor:pointer;
    color:rgba(255,255,255,0.55); font-size:13px; font-weight:700;
    transition:all 0.1s; flex-shrink:0;
  }
  .ec-rich-btn:hover { background:rgba(255,255,255,0.1); color:white; }
  .ec-rich-sep { width:1px; height:16px; background:rgba(255,255,255,0.12); margin:0 3px; flex-shrink:0; }
  .ec-rich-iframe { flex:1; border:none; width:100%; background:white; display:block; min-height:0; }

  .ec-mode-toggle {
    display:inline-flex; background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.1); border-radius:6px; overflow:hidden;
  }
  .ec-mode-btn {
    padding:0 10px; height:22px; border:none; cursor:pointer;
    font-size:11px; font-weight:600; transition:all 0.15s;
    background:transparent; color:rgba(255,255,255,0.4);
  }
  .ec-mode-btn.active { background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); }
  .ec-mode-btn:hover:not(.active) { color:rgba(255,255,255,0.7); }

  .ec-section-label {
    font-size:11px; font-weight:700; color:rgba(255,255,255,0.35);
    text-transform:uppercase; letter-spacing:0.07em; margin:0 0 10px;
  }
  .ec-field-label {
    display:block; font-size:12px; font-weight:500;
    color:rgba(255,255,255,0.48); margin-bottom:6px;
  }
  .ec-divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:16px 0; }
  .ec-empty { text-align:center; padding:40px 20px; color:rgba(255,255,255,0.35); font-size:14px; }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmailCampaigns() {
  const navigate = useNavigate();

  // Builder state
  const [campaignType, setCampaignType]   = useState('');
  const [segFilters, setSegFilters]        = useState<SegFilters>({
    profileCompleted: '', emailVerified: '', approvalStatus: '', gender: '', country: '',
  });
  const [campaignName, setCampaignName]   = useState('');
  const [subject, setSubject]             = useState('');
  const [batchSize, setBatchSize]         = useState(100);
  const [ratePerHour, setRatePerHour]     = useState(100);
  const [advancedOpen, setAdvancedOpen]   = useState(false);

  // Committed HTML state (saved from modal)
  const [htmlContent, setHtmlContent]         = useState('');
  const [templateLoaded, setTemplateLoaded]   = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [editorError, setEditorError]         = useState('');
  const [lastEdited, setLastEdited]           = useState<Date | null>(null);

  // Editor modal state
  const [editorModalOpen, setEditorModalOpen]       = useState(false);
  const [pendingHtml, setPendingHtml]               = useState('');
  const [pendingPreviewHtml, setPendingPreviewHtml] = useState('');
  const [previewMode, setPreviewMode]               = useState<'desktop' | 'mobile'>('desktop');
  const [editorUnsavedConfirm, setEditorUnsavedConfirm] = useState(false);
  const [modalVarDropdownOpen, setModalVarDropdownOpen] = useState(false);
  const [modalCopiedVar, setModalCopiedVar]         = useState('');
  const [modalTab, setModalTab]                     = useState<'html' | 'preview'>('html');
  const [editorMode, setEditorMode] = useState<'html' | 'rich'>('html');

  const htmlOnOpenRef      = useRef('');
  const modalVarBtnRef     = useRef<HTMLDivElement>(null);
  const richEditorRef      = useRef<HTMLIFrameElement>(null);
  const richInputTimerRef  = useRef<ReturnType<typeof setTimeout>>();
  const pendingHtmlRef     = useRef(pendingHtml);

  // Preview / recipients state
  const [previewResult, setPreviewResult]     = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [previewRan, setPreviewRan]           = useState(false);
  const [excludedIds, setExcludedIds]         = useState<string[]>([]);
  const [previewCreators, setPreviewCreators] = useState<any[]>([]);
  const [previewPage, setPreviewPage]         = useState(1);
  const [previewTotalPages, setPreviewTotalPages] = useState(1);
  const [previewTotal, setPreviewTotal]       = useState(0);
  const [previewSampleOnly, setPreviewSampleOnly] = useState(false);
  const [previewAllLoading, setPreviewAllLoading] = useState(false);

  // Send state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending]         = useState(false);

  // History state
  const [campaigns, setCampaigns]               = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignsError, setCampaignsError]     = useState('');

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const hasRunningRef = useRef(false);

  // ── Keep pendingHtmlRef in sync ──────────────────────────────────────────────
  useEffect(() => { pendingHtmlRef.current = pendingHtml; }, [pendingHtml]);

  // ── Debounced modal preview ──────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setPendingPreviewHtml(buildPreview(pendingHtml)), 300);
    return () => clearTimeout(id);
  }, [pendingHtml]);

  // ── Initialize rich editor iframe when entering rich mode ────────────────────
  useEffect(() => {
    if (editorMode !== 'rich') return;
    const iframe = richEditorRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(pendingHtmlRef.current);
    doc.close();
    doc.designMode = 'on';
    const handleInput = () => {
      clearTimeout(richInputTimerRef.current);
      richInputTimerRef.current = setTimeout(() => {
        if (iframe.contentDocument) {
          const updated = '<!DOCTYPE html>\n' + iframe.contentDocument.documentElement.outerHTML;
          setPendingHtml(updated);
        }
      }, 300);
    };
    doc.addEventListener('input', handleInput);
    return () => {
      doc.removeEventListener('input', handleInput);
      clearTimeout(richInputTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode]);

  // ── Load template when type changes ─────────────────────────────────────────
  useEffect(() => {
    if (!campaignType) {
      setHtmlContent('');
      setTemplateLoaded(false);
      setPreviewRan(false);
      setPreviewResult(null);
      setPreviewCreators([]);
      setExcludedIds([]);
      setPreviewTotal(0);
      return;
    }
    setPreviewRan(false);
    setPreviewResult(null);
    setPreviewCreators([]);
    setExcludedIds([]);
    setPreviewTotal(0);
    loadTemplate(campaignType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignType]);

  // ── Close modal var dropdown on outside click ────────────────────────────────
  useEffect(() => {
    if (!modalVarDropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (modalVarBtnRef.current && !modalVarBtnRef.current.contains(e.target as Node)) {
        setModalVarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [modalVarDropdownOpen]);

  // ── Mount + auto-refresh ─────────────────────────────────────────────────────
  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    setCampaignsError('');
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns`, { headers: apiHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (e: any) {
      setCampaignsError(e.message);
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    hasRunningRef.current = campaigns.some(c => c.status === 'running');
  }, [campaigns]);

  useEffect(() => {
    const id = setInterval(() => { if (hasRunningRef.current) fetchCampaigns(); }, 10000);
    return () => clearInterval(id);
  }, [fetchCampaigns]);

  // ── API helpers ──────────────────────────────────────────────────────────────
  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadTemplate = async (type: string) => {
    setTemplateLoading(true);
    setEditorError('');
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns/templates/${type}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.html) throw new Error('Empty response');
      setHtmlContent(data.html);
      setTemplateLoaded(true);
    } catch (_) {
      const fallback = TEMPLATE_DEFAULTS[type];
      if (fallback) {
        setHtmlContent(fallback);
        setTemplateLoaded(true);
      } else {
        setEditorError('Failed to load template');
      }
    } finally {
      setTemplateLoading(false);
    }
  };

  // ── Editor modal helpers ─────────────────────────────────────────────────────
  const openEditorModal = () => {
    htmlOnOpenRef.current = htmlContent;
    setPendingHtml(htmlContent);
    setEditorUnsavedConfirm(false);
    setPreviewMode('desktop');
    setModalVarDropdownOpen(false);
    setModalTab('html');
    setEditorMode('html');
    setEditorModalOpen(true);
  };

  const handleEditorModeSwitch = (mode: 'html' | 'rich') => {
    if (mode === editorMode) return;
    if (mode === 'html' && richEditorRef.current?.contentDocument) {
      const doc = richEditorRef.current.contentDocument;
      const updated = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      setPendingHtml(updated);
      pendingHtmlRef.current = updated;
    }
    setEditorMode(mode);
  };

  const execRich = (command: string, value?: string) => {
    const doc = richEditorRef.current?.contentDocument;
    if (!doc) return;
    doc.execCommand(command, false, value ?? undefined);
    richEditorRef.current?.contentWindow?.focus();
    // Sync state after command
    clearTimeout(richInputTimerRef.current);
    richInputTimerRef.current = setTimeout(() => {
      if (richEditorRef.current?.contentDocument) {
        const updated = '<!DOCTYPE html>\n' + richEditorRef.current.contentDocument.documentElement.outerHTML;
        setPendingHtml(updated);
      }
    }, 50);
  };

  const handleModalSaveClose = () => {
    setHtmlContent(pendingHtml);
    setTemplateLoaded(true);
    setLastEdited(new Date());
    setEditorModalOpen(false);
    setEditorUnsavedConfirm(false);
  };

  const handleModalClose = () => {
    if (pendingHtml !== htmlOnOpenRef.current) {
      setEditorUnsavedConfirm(true);
    } else {
      setEditorModalOpen(false);
    }
  };

  const handleModalDiscard = () => {
    setEditorModalOpen(false);
    setEditorUnsavedConfirm(false);
  };

  const handleModalResetDefault = () => {
    if (!window.confirm('Reset will discard your changes. Continue?')) return;
    const fallback = TEMPLATE_DEFAULTS[campaignType];
    if (fallback) {
      setPendingHtml(fallback);
      htmlOnOpenRef.current = fallback;
    }
  };

  const handleModalCopyVar = (v: string) => {
    navigator.clipboard.writeText(v).catch(() => {});
    setModalCopiedVar(v);
    setTimeout(() => setModalCopiedVar(''), 1500);
    setModalVarDropdownOpen(false);
  };

  const handleModalTabKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const s = el.selectionStart;
    const end = el.selectionEnd;
    const next = pendingHtml.substring(0, s) + '  ' + pendingHtml.substring(end);
    setPendingHtml(next);
    setTimeout(() => el.setSelectionRange(s + 2, s + 2), 0);
  };

  // ── Preview helpers ──────────────────────────────────────────────────────────
  const buildPreviewFilters = () => {
    if (campaignType !== 'custom_segment') return undefined;
    const f: any = {};
    if (segFilters.profileCompleted !== '') f.is_profile_completed = segFilters.profileCompleted === 'true';
    if (segFilters.emailVerified    !== '') f.is_email_verified    = segFilters.emailVerified    === 'true';
    if (segFilters.approvalStatus   !== '') f.is_approved_by_admin = segFilters.approvalStatus   === 'true';
    if (segFilters.gender)  f.gender  = segFilters.gender;
    if (segFilters.country) f.country = segFilters.country;
    return f;
  };

  const buildTargetFilters = () => {
    if (campaignType !== 'custom_segment') return {};
    const f: any = {};
    if (segFilters.profileCompleted !== '') f.profileCompleted = segFilters.profileCompleted === 'true';
    if (segFilters.emailVerified    !== '') f.emailVerified    = segFilters.emailVerified    === 'true';
    if (segFilters.country) f.country = segFilters.country;
    return f;
  };

  const handlePreviewAll = async (page: number) => {
    setPreviewAllLoading(true);
    try {
      const params = new URLSearchParams({ type: campaignType, page: String(page), limit: '50' });
      const filters = buildPreviewFilters();
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => params.set(k, String(v)));
      }
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns/preview/all?${params}`, {
        headers: apiHeaders(),
      });
      if (res.status === 404) {
        setPreviewSampleOnly(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreviewCreators(data.creators || []);
      setPreviewPage(page);
      setPreviewTotalPages(data.totalPages || 1);
      setPreviewSampleOnly(false);
    } catch (_) {
      setPreviewSampleOnly(true);
    } finally {
      setPreviewAllLoading(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewResult(null);
    setPreviewCreators([]);
    setExcludedIds([]);
    setPreviewSampleOnly(false);
    setPreviewTotal(0);
    try {
      const body: any = { type: campaignType };
      const f = buildPreviewFilters();
      if (f) body.filters = f;
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns/preview`, {
        method: 'POST', headers: apiHeaders(true), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreviewResult(data);
      setPreviewRan(true);
      setPreviewTotal(data.count || 0);
      handlePreviewAll(1);
    } catch (e: any) {
      showToast(`Preview failed: ${e.message}`, false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmSend = async () => {
    setSending(true);
    setConfirmOpen(false);
    try {
      const createRes = await fetch(`${EMAIL_SERVICE_URL}/campaigns`, {
        method: 'POST',
        headers: apiHeaders(true),
        body: JSON.stringify({
          name: campaignName,
          templateType: toTemplateType(campaignType),
          subject,
          customBody: htmlContent,
          targetFilters: buildTargetFilters(),
          excluded_ids: excludedIds,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || `HTTP ${createRes.status}`);
      }
      const campaign = await createRes.json();

      const sendRes = await fetch(`${EMAIL_SERVICE_URL}/campaigns/${campaign._id}/send`, {
        method: 'POST', headers: apiHeaders(),
      });
      if (!sendRes.ok) {
        const err = await sendRes.json();
        throw new Error(err.error || 'Send failed');
      }

      showToast('Campaign started successfully', true);
      resetForm();
      fetchCampaigns();
    } catch (e: any) {
      showToast(`Error: ${e.message}`, false);
    } finally {
      setSending(false);
    }
  };

  const handlePause = async (id: string) => {
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns/${id}`, {
        method: 'PATCH', headers: apiHeaders(true), body: JSON.stringify({ status: 'paused' }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Pause failed'); }
      fetchCampaigns();
    } catch (e: any) { showToast(e.message, false); }
  };

  const handleResume = async (id: string) => {
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/campaigns/${id}`, {
        method: 'PATCH', headers: apiHeaders(true), body: JSON.stringify({ status: 'running' }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Resume failed'); }
      fetchCampaigns();
    } catch (e: any) { showToast(e.message, false); }
  };

  const resetForm = () => {
    setCampaignType('');
    setSegFilters({ profileCompleted: '', emailVerified: '', approvalStatus: '', gender: '', country: '' });
    setCampaignName('');
    setSubject('');
    setHtmlContent('');
    setTemplateLoaded(false);
    setBatchSize(100);
    setRatePerHour(100);
    setPreviewResult(null);
    setPreviewRan(false);
    setLastEdited(null);
    setExcludedIds([]);
    setPreviewCreators([]);
    setPreviewTotal(0);
    setPreviewTotalPages(1);
    setPreviewPage(1);
    setPreviewSampleOnly(false);
    setEditorModalOpen(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const canPreview   = !!campaignType && !previewLoading;
  const canSend      = !!campaignType && !!campaignName.trim() && !!subject.trim() && !!htmlContent.trim() && previewRan && !sending;
  const recipientCount = previewResult?.count ?? 0;
  const selectedCount  = Math.max(0, recipientCount - excludedIds.length);
  const estHours     = ratePerHour > 0 ? recipientCount / ratePerHour : 0;
  const estLabel     = recipientCount === 0 ? 'Run preview first'
    : estHours >= 1 ? `~${Math.ceil(estHours)} hours to complete`
    : `~${Math.ceil(estHours * 60)} minutes to complete`;
  const modalLineCount = pendingHtml ? pendingHtml.split('\n').length : 0;
  const modalCharCount = pendingHtml.length;
  const currentTypeMeta = CAMPAIGN_TYPES.find(t => t.id === campaignType);
  const iframeWidth  = previewMode === 'desktop' ? 600 : 375;

  // Per-page checkbox state
  const allPageSelected   = previewCreators.length > 0 && previewCreators.every((c: any) => !excludedIds.includes(c._id));

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>

      <div style={{ color: 'white', fontFamily: 'inherit' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>Email Campaigns</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            Build and send targeted email campaigns to your creator community
          </p>
        </div>

        <div className="ec-layout">

          {/* ── LEFT: Campaign Builder ──────────────────────────────────────── */}
          <div>
            <div className="ec-card">
              <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>New Campaign</h2>

              {/* Step 1 — Type */}
              <div style={{ marginBottom: 20 }}>
                <p className="ec-section-label">Step 1 — Campaign Type</p>
                <div className="ec-type-grid">
                  {CAMPAIGN_TYPES.map(t => (
                    <button
                      key={t.id}
                      className={`ec-type-card${campaignType === t.id ? ' sel' : ''}`}
                      onClick={() => setCampaignType(t.id)}
                    >
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 3 }}>{t.title}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Segment filters */}
              <div className={`ec-collapsible${campaignType === 'custom_segment' ? ' open' : ' closed'}`}>
                <div style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>Segment Filters</p>
                  <p style={{ margin: '0 0 14px', fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>Leave blank to ignore</p>
                  <div className="ec-filter-grid">
                    <div>
                      <label className="ec-field-label">Profile Status</label>
                      <select className="ec-select" value={segFilters.profileCompleted} onChange={e => setSegFilters(p => ({ ...p, profileCompleted: e.target.value as any }))}>
                        <option value="">All</option><option value="true">Complete</option><option value="false">Incomplete</option>
                      </select>
                    </div>
                    <div>
                      <label className="ec-field-label">Email Verified</label>
                      <select className="ec-select" value={segFilters.emailVerified} onChange={e => setSegFilters(p => ({ ...p, emailVerified: e.target.value as any }))}>
                        <option value="">All</option><option value="true">Verified</option><option value="false">Unverified</option>
                      </select>
                    </div>
                    <div>
                      <label className="ec-field-label">Approval Status</label>
                      <select className="ec-select" value={segFilters.approvalStatus} onChange={e => setSegFilters(p => ({ ...p, approvalStatus: e.target.value as any }))}>
                        <option value="">All</option><option value="true">Approved</option><option value="false">Pending</option>
                      </select>
                    </div>
                    <div>
                      <label className="ec-field-label">Gender</label>
                      <select className="ec-select" value={segFilters.gender} onChange={e => setSegFilters(p => ({ ...p, gender: e.target.value }))}>
                        <option value="">All</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="ec-field-label">Country</label>
                      <input className="ec-input" placeholder="e.g. Pakistan" value={segFilters.country} onChange={e => setSegFilters(p => ({ ...p, country: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="ec-divider" />

              {/* Step 2 — Details */}
              <div style={{ marginBottom: 20 }}>
                <p className="ec-section-label">Step 2 — Campaign Details</p>
                <div style={{ marginBottom: 12 }}>
                  <label className="ec-field-label">Campaign Name</label>
                  <input className="ec-input" placeholder="e.g. March Incomplete Profile Reminder" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
                </div>
                <div>
                  <label className="ec-field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subject Line</span>
                    <span style={{ color: subject.length > 90 ? '#f59e0b' : 'rgba(255,255,255,0.28)' }}>{subject.length}/100</span>
                  </label>
                  <input className="ec-input" placeholder="e.g. Complete your Collabscafe profile 🎯" value={subject} maxLength={100} onChange={e => setSubject(e.target.value)} />
                </div>
              </div>

              <hr className="ec-divider" />

              {/* Step 3 — Email Template (compact trigger row) */}
              <div style={{ marginBottom: 20 }}>
                <p className="ec-section-label">Step 3 — Email Template</p>
                <div className="ec-template-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>Email Template</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>Click to edit the HTML template</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {templateLoaded ? (
                      <span style={{ fontSize: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✓ Template Ready
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: templateLoading ? 'rgba(255,255,255,0.4)' : '#f59e0b' }}>
                        {templateLoading ? 'Loading…' : (campaignType ? 'No template loaded' : 'Select a type first')}
                      </span>
                    )}
                    <button
                      className="ec-btn ec-btn-outline"
                      onClick={openEditorModal}
                      disabled={!campaignType || templateLoading}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                      </svg>
                      Edit Template
                    </button>
                  </div>
                </div>
                {editorError && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>{editorError}</p>
                )}
                {!htmlContent.trim() && templateLoaded && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#ef4444' }}>
                    Email template cannot be empty
                  </p>
                )}
              </div>

              {/* Advanced settings */}
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => setAdvancedOpen(o => !o)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
                >
                  <span style={{ fontSize: 10, transform: advancedOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                  Advanced Settings
                </button>
                <div className={`ec-collapsible${advancedOpen ? ' open' : ' closed'}`}>
                  <div style={{ paddingTop: 12 }}>
                    <div className="ec-filter-grid">
                      <div>
                        <label className="ec-field-label">Batch Size</label>
                        <input type="number" className="ec-input" min={10} max={500} value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="ec-field-label">Rate per Hour</label>
                        <input type="number" className="ec-input" min={10} max={500} value={ratePerHour} onChange={e => setRatePerHour(Number(e.target.value))} />
                      </div>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                      At {ratePerHour}/hr, {recipientCount > 0 ? recipientCount.toLocaleString() : '?'} creators = {estLabel}
                    </p>
                  </div>
                </div>
              </div>

              <hr className="ec-divider" />

              {/* Preview Recipients */}
              <div style={{ marginBottom: 16 }}>
                <button className="ec-btn ec-btn-outline" disabled={!canPreview} onClick={handlePreview}>
                  {previewLoading ? <><span className="ec-spinner" /> Previewing…</> : 'Preview Recipients →'}
                </button>

                {previewResult && (
                  <>
                    {previewResult.count === 0 ? (
                      <div style={{ marginTop: 12, padding: 12, background: '#1f2937', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p style={{ margin: 0, fontSize: 13, color: '#f59e0b' }}>⚠️ No creators match this segment</p>
                      </div>
                    ) : (
                      <div className="ec-recip">
                        {/* Header */}
                        <div className="ec-recip-hdr">
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                            <span style={{ color: '#4f46e5', fontWeight: 700, fontSize: 15 }}>{selectedCount.toLocaleString()}</span>
                            {' '}of{' '}
                            <span style={{ fontWeight: 600 }}>{recipientCount.toLocaleString()}</span>
                            {' '}creators selected
                          </span>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <button
                              onClick={() => setExcludedIds([])}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', fontSize: 13, padding: 0, fontWeight: 500 }}
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => setExcludedIds(previewCreators.map((c: any) => c._id).filter(Boolean))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', fontSize: 13, padding: 0, fontWeight: 500 }}
                            >
                              Deselect All
                            </button>
                          </div>
                        </div>

                        {/* Body */}
                        {previewSampleOnly ? (
                          <div style={{ padding: '10px 14px' }}>
                            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#f59e0b' }}>
                              Showing sample only — full list endpoint not available yet
                            </p>
                            <table className="ec-recip-table">
                              <thead>
                                <tr>
                                  <th style={{ width: 40 }}>#</th>
                                  <th>Name</th>
                                  <th>Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewResult.sample.map((s, i) => (
                                  <tr key={i}>
                                    <td style={{ color: 'rgba(255,255,255,0.3)' }}>{i + 1}</td>
                                    <td style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{s.name}</td>
                                    <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{s.email}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : previewAllLoading && previewCreators.length === 0 ? (
                          <div style={{ padding: 24, textAlign: 'center' }}>
                            <span className="ec-spinner" />
                          </div>
                        ) : (
                          <>
                            <table className="ec-recip-table">
                              <thead>
                                <tr>
                                  <th style={{ width: 28, paddingLeft: 14 }}>
                                    <input
                                      type="checkbox"
                                      checked={allPageSelected}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          setExcludedIds(prev => prev.filter(id => !previewCreators.find((c: any) => c._id === id)));
                                        } else {
                                          const pageIds = previewCreators.map((c: any) => c._id).filter(Boolean);
                                          setExcludedIds(prev => [...new Set([...prev, ...pageIds])]);
                                        }
                                      }}
                                    />
                                  </th>
                                  <th style={{ width: 40 }}>#</th>
                                  <th>Name</th>
                                  <th>Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewCreators.map((c: any, i) => {
                                  const isExcluded = excludedIds.includes(c._id);
                                  const rowNum = (previewPage - 1) * 50 + i + 1;
                                  return (
                                    <tr key={c._id || i} className={isExcluded ? 'excluded' : ''}>
                                      <td style={{ paddingLeft: 14, width: 28 }}>
                                        <input
                                          type="checkbox"
                                          checked={!isExcluded}
                                          onChange={e => {
                                            if (e.target.checked) {
                                              setExcludedIds(prev => prev.filter(id => id !== c._id));
                                            } else {
                                              setExcludedIds(prev => [...prev, c._id]);
                                            }
                                          }}
                                        />
                                      </td>
                                      <td style={{ color: 'rgba(255,255,255,0.3)', width: 40 }}>{rowNum}</td>
                                      <td style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{c.name}</td>
                                      <td style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: isExcluded ? 'line-through' : 'none' }}>{c.email}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {previewAllLoading && (
                              <div style={{ padding: '8px 0', textAlign: 'center' }}>
                                <span className="ec-spinner" style={{ width: 14, height: 14 }} />
                              </div>
                            )}
                            {previewTotalPages > 1 && (
                              <div className="ec-recip-pager">
                                <button
                                  className="ec-btn ec-btn-gray"
                                  style={{ padding: '5px 10px', fontSize: 12 }}
                                  disabled={previewPage <= 1 || previewAllLoading}
                                  onClick={() => handlePreviewAll(previewPage - 1)}
                                >
                                  ← Prev
                                </button>
                                <span>Page {previewPage} of {previewTotalPages}</span>
                                <button
                                  className="ec-btn ec-btn-gray"
                                  style={{ padding: '5px 10px', fontSize: 12 }}
                                  disabled={previewPage >= previewTotalPages || previewAllLoading}
                                  onClick={() => handlePreviewAll(previewPage + 1)}
                                >
                                  Next →
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Send */}
              <button className="ec-btn-send" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
                {sending ? <><span className="ec-spinner" style={{ borderTopColor: 'white' }} /> Sending…</> : 'Send Campaign'}
              </button>
              {!previewRan && campaignType && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                  Run preview to enable send
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Campaign History ─────────────────────────────────────── */}
          <div>
            <div className="ec-card">
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h2 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700 }}>Campaign History</h2>
                  <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Auto-refreshes every 10s while campaigns are running</p>
                </div>
                <button className="ec-btn ec-btn-gray" style={{ fontSize: 12, padding: '6px 12px' }} onClick={fetchCampaigns}>↻ Refresh</button>
              </div>

              {campaignsError && (
                <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Error: {campaignsError}</span>
                  <button className="ec-btn ec-btn-gray" style={{ fontSize: 11, padding: '4px 10px' }} onClick={fetchCampaigns}>Retry</button>
                </div>
              )}

              {campaignsLoading && campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div className="ec-spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="ec-empty">No campaigns yet. Create your first campaign →</div>
              ) : (
                campaigns.map(c => {
                  const pct = c.totalTargeted > 0 ? Math.min(100, (c.sentCount / c.totalTargeted) * 100) : 0;
                  const tm  = TYPE_META[c.templateType] || { label: c.templateType, color: '#6b7280' };
                  const sm  = STATUS_META[c.status] || { label: c.status, color: '#6b7280', pulse: false };
                  const showBar = c.status === 'running' || c.status === 'completed' || c.status === 'paused';
                  return (
                    <div key={c._id} className="ec-campaign-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span className="ec-badge" style={{ background: tm.color + '22', color: tm.color }}>{tm.label}</span>
                            <span className="ec-badge" style={{ background: sm.color + '22', color: sm.color }}>
                              {sm.pulse && <span className="ec-dot-pulse" style={{ background: sm.color }} />}
                              {sm.label}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {c.status === 'running'  && <button className="ec-btn ec-btn-amber"    style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => handlePause(c._id)}>Pause</button>}
                          {c.status === 'paused'   && <button className="ec-btn ec-btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => handleResume(c._id)}>Resume</button>}
                          {(c.status === 'completed' || c.status === 'failed') && (
                            <button className="ec-btn ec-btn-gray" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => navigate(`/email-campaigns/${c._id}`)}>View Logs</button>
                          )}
                          <button className="ec-btn ec-btn-gray" style={{ padding: '5px 10px', fontSize: 16, lineHeight: 1 }} title="View details" onClick={() => navigate(`/email-campaigns/${c._id}`)}>👁</button>
                        </div>
                      </div>
                      {showBar && (
                        <div style={{ marginBottom: 6 }}>
                          <div className="ec-progress-bar">
                            <div className="ec-progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
                            {c.sentCount.toLocaleString()} / {c.totalTargeted.toLocaleString()} sent
                            {c.failedCount > 0 && <span style={{ color: '#ef4444', marginLeft: 8 }}>· {c.failedCount} failed</span>}
                          </p>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Created {fmtDate(c.createdAt)}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Confirm Send Modal ──────────────────────────────────────────────── */}
      {confirmOpen && (
        <div className="ec-backdrop" onClick={() => setConfirmOpen(false)}>
          <div className="ec-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'white' }}>
              Send to {selectedCount.toLocaleString()} creators?
            </h3>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>
              Subject: <span style={{ color: 'rgba(255,255,255,0.8)' }}>{subject}</span>
            </p>
            {excludedIds.length > 0 && (
              <p style={{ margin: '0 0 6px', fontSize: 12, color: '#f59e0b' }}>
                {excludedIds.length} creator{excludedIds.length !== 1 ? 's' : ''} excluded
              </p>
            )}
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              Will send at {ratePerHour}/hour in batches of {batchSize}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="ec-btn ec-btn-gray" style={{ flex: 1 }} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button
                style={{ flex: 1, background: 'linear-gradient(to right,#079f82,#7c6edd)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                onClick={handleConfirmSend}
              >
                Confirm Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor Modal ────────────────────────────────────────────────────── */}
      {editorModalOpen && (
        <>
          <div className="ec-emod-overlay" />
          <div className="ec-emod">

            {/* Header */}
            <div className="ec-emod-header">

              {/* Left: title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2 }}>Email Template Editor</span>
                {currentTypeMeta && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.2 }}>{currentTypeMeta.title}</span>
                )}
              </div>

              {/* Center: Desktop/Mobile toggle (desktop only) */}
              <div className="ec-emod-desktop-ctrl">
                <button
                  className={`ec-emod-pill${previewMode === 'desktop' ? ' active' : ' inactive'}`}
                  onClick={() => setPreviewMode('desktop')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  Desktop
                </button>
                <button
                  className={`ec-emod-pill${previewMode === 'mobile' ? ' active' : ' inactive'}`}
                  onClick={() => setPreviewMode('mobile')}
                >
                  <svg width="11" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                  Mobile
                </button>
              </div>

              {/* Center: Mobile tabs (mobile only) */}
              <div className="ec-emod-mob-tabs">
                <button className={`ec-mob-tab${modalTab === 'html' ? ' active' : ''}`} onClick={() => setModalTab('html')}>HTML</button>
                <button className={`ec-mob-tab${modalTab === 'preview' ? ' active' : ''}`} onClick={() => setModalTab('preview')}>Preview</button>
              </div>

              {/* Right: actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12, padding: '4px 6px', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                  onClick={handleModalResetDefault}
                >
                  Reset
                </button>

                <div ref={modalVarBtnRef} style={{ position: 'relative' }}>
                  <button
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}
                    onClick={() => setModalVarDropdownOpen(o => !o)}
                  >
                    {'{ }'} Variable
                  </button>
                  {modalVarDropdownOpen && (
                    <div className="ec-var-dropdown">
                      {INSERT_VARS.map(v => (
                        <button key={v.key} className="ec-var-item" onClick={() => handleModalCopyVar(v.key)}>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#818cf8' }}>{v.key}</span>
                          <span style={{ fontSize: 11, color: modalCopiedVar === v.key ? '#10b981' : 'rgba(255,255,255,0.35)' }}>
                            {modalCopiedVar === v.key ? 'Copied!' : v.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleModalSaveClose}
                  style={{ background: 'linear-gradient(to right,#079f82,#7c6edd)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Save & Close
                </button>

                <button
                  onClick={handleModalClose}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1, padding: '0 4px', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Unsaved changes warning bar */}
            {editorUnsavedConfirm && (
              <div className="ec-emod-unsaved">
                <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 500 }}>You have unsaved changes</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleModalSaveClose}
                    style={{ background: 'linear-gradient(to right,#079f82,#7c6edd)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save & Close
                  </button>
                  <button
                    onClick={handleModalDiscard}
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
                  >
                    Discard Changes
                  </button>
                </div>
              </div>
            )}

            {/* Body: editor + preview */}
            <div className="ec-emod-body">

              {/* Left: editor (HTML textarea or Rich Text iframe) */}
              <div className={`ec-emod-left${modalTab === 'preview' ? ' ec-emod-panel-hidden' : ''}`}>

                {/* Mode bar */}
                <div className="ec-emod-ebar">
                  <div className="ec-mode-toggle">
                    <button
                      className={`ec-mode-btn${editorMode === 'html' ? ' active' : ''}`}
                      onClick={() => handleEditorModeSwitch('html')}
                    >
                      HTML
                    </button>
                    <button
                      className={`ec-mode-btn${editorMode === 'rich' ? ' active' : ''}`}
                      onClick={() => handleEditorModeSwitch('rich')}
                    >
                      Rich Text
                    </button>
                  </div>
                  {editorMode === 'html' && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.15)', marginLeft: 8 }}>|</span>
                      <span>{modalLineCount} lines</span>
                      <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                      <span>{modalCharCount.toLocaleString()} chars</span>
                    </>
                  )}
                </div>

                {/* Rich text toolbar (rich mode only) */}
                {editorMode === 'rich' && (
                  <div className="ec-rich-toolbar">
                    <button className="ec-rich-btn" title="Bold" onClick={() => execRich('bold')}><b>B</b></button>
                    <button className="ec-rich-btn" title="Italic" onClick={() => execRich('italic')} style={{ fontStyle: 'italic' }}>I</button>
                    <button className="ec-rich-btn" title="Underline" onClick={() => execRich('underline')} style={{ textDecoration: 'underline' }}>U</button>
                    <button className="ec-rich-btn" title="Strikethrough" onClick={() => execRich('strikeThrough')} style={{ textDecoration: 'line-through', fontSize: 12 }}>S</button>
                    <div className="ec-rich-sep" />
                    <button className="ec-rich-btn" title="Heading 1" onClick={() => execRich('formatBlock', 'h1')} style={{ fontSize: 11 }}>H1</button>
                    <button className="ec-rich-btn" title="Heading 2" onClick={() => execRich('formatBlock', 'h2')} style={{ fontSize: 11 }}>H2</button>
                    <button className="ec-rich-btn" title="Paragraph" onClick={() => execRich('formatBlock', 'p')} style={{ fontSize: 11 }}>¶</button>
                    <div className="ec-rich-sep" />
                    <button className="ec-rich-btn" title="Bullet list" onClick={() => execRich('insertUnorderedList')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
                    </button>
                    <button className="ec-rich-btn" title="Numbered list" onClick={() => execRich('insertOrderedList')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor" strokeLinecap="round"/><path d="M4 10h2" stroke="currentColor" strokeLinecap="round"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor" strokeLinecap="round"/></svg>
                    </button>
                    <div className="ec-rich-sep" />
                    <button
                      className="ec-rich-btn"
                      title="Insert link"
                      onClick={() => {
                        const url = window.prompt('Enter URL:');
                        if (url) execRich('createLink', url);
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </button>
                    <div className="ec-rich-sep" />
                    <button className="ec-rich-btn" title="Align left" onClick={() => execRich('justifyLeft')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                    </button>
                    <button className="ec-rich-btn" title="Align center" onClick={() => execRich('justifyCenter')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                    </button>
                    <button className="ec-rich-btn" title="Align right" onClick={() => execRich('justifyRight')}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <div className="ec-rich-sep" />
                    <button
                      className="ec-rich-btn"
                      title="Remove formatting"
                      onClick={() => execRich('removeFormat')}
                      style={{ fontSize: 11, width: 'auto', padding: '0 6px' }}
                    >
                      Tx
                    </button>
                  </div>
                )}

                {/* HTML textarea */}
                {editorMode === 'html' && (
                  <textarea
                    className="ec-emod-textarea"
                    value={pendingHtml}
                    onChange={e => setPendingHtml(e.target.value)}
                    onKeyDown={handleModalTabKey}
                    spellCheck={false}
                    placeholder="HTML template content…"
                  />
                )}

                {/* Rich text iframe (always mounted when modal open so ref is stable) */}
                <iframe
                  ref={richEditorRef}
                  className="ec-rich-iframe"
                  title="Rich Text Editor"
                  style={{ display: editorMode === 'rich' ? 'block' : 'none' }}
                  sandbox="allow-same-origin allow-scripts"
                />

              </div>

              {/* Right: live preview */}
              <div className={`ec-emod-right${modalTab === 'html' ? ' ec-emod-panel-hidden' : ''}`}>
                <div className="ec-emod-pbar">
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Preview</span>
                  <span>{previewMode === 'desktop' ? 'Desktop (600px)' : 'Mobile (375px)'}</span>
                </div>
                <div className="ec-emod-iframe-wrap">
                  <iframe
                    style={{
                      width: iframeWidth,
                      minHeight: 500,
                      height: 700,
                      border: 'none',
                      background: 'white',
                      borderRadius: 8,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                      flexShrink: 0,
                      display: 'block',
                    }}
                    srcDoc={pendingPreviewHtml}
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="ec-toast" style={{ background: toast.ok ? '#065f46' : '#7f1d1d', color: toast.ok ? '#d1fae5' : '#fecaca', border: `1px solid ${toast.ok ? '#10b981' : '#ef4444'}` }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
