import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
}

interface Recipient {
  name: string;
  email: string;
  customFields?: Record<string, string>;
}

// ── Default template ──────────────────────────────────────────────────────────
const DEFAULT_TEMPLATE = `<!DOCTYPE html>
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
    .body p { margin: 0 0 16px; }
    .cta { display: block; width: fit-content; margin: 28px auto 0; background: linear-gradient(135deg, #079f82, #7c6edd); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; text-align: center; }
    .footer { padding: 24px 32px; text-align: center; background: #f9fafb; border-top: 1px solid #f0f0f0; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; }
    .footer a { color: #079f82; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Message from Collabscafe</h1>
    </div>
    <div class="body">
      <p>Hi {{first_name}},</p>
      <p>Write your message here.</p>
    </div>
    <div class="footer">
      <p>
        You're receiving this from <a href="https://collabscafe.com">Collabscafe</a>.<br />
        <a href="https://collabscafe.com/unsubscribe?email={{email}}">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;

// ── Status meta ───────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: '#6b7280' },
  running:   { label: 'Running',   color: '#10b981' },
  paused:    { label: 'Paused',    color: '#f59e0b' },
  completed: { label: 'Completed', color: '#3b82f6' },
  failed:    { label: 'Failed',    color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

const BASE_VARS = [
  { key: '{{first_name}}', label: "Recipient's first name" },
  { key: '{{name}}',       label: "Recipient's full name" },
  { key: '{{email}}',      label: "Recipient's email" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    .replace(/\{\{\s*first_name\s*\}\}/gi, 'John')
    .replace(/\{\{\s*name\s*\}\}/gi, 'John Smith')
    .replace(/\{\{\s*email\s*\}\}/gi, 'john@example.com')
    .replace(/\{\{\s*\w+\s*\}\}/g, '');
}

// ── Styles ────────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes cc-spin  { to { transform: rotate(360deg); } }
  @keyframes cc-pulse { 0%,100%{ opacity:1; } 50%{ opacity:0.35; } }
  @keyframes cc-toast { from { transform:translateY(12px); opacity:0; } to { transform:translateY(0); opacity:1; } }
  @keyframes cc-fadein { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

  .cc-layout { display:grid; grid-template-columns:1fr; gap:20px; }
  @media(min-width:1024px){ .cc-layout{ grid-template-columns:2fr 3fr; align-items:start; } }

  .cc-card {
    background:#111827;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:12px; padding:20px;
  }

  .cc-input {
    width:100%; background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; padding:10px 12px;
    color:white; font-size:14px; outline:none;
    transition:border-color 0.15s ease; box-sizing:border-box;
  }
  .cc-input:focus { border-color:rgba(79,70,229,0.7); }
  .cc-input::placeholder { color:rgba(255,255,255,0.28); }

  .cc-btn {
    border:none; border-radius:8px;
    padding:9px 16px; font-size:13px; font-weight:500;
    cursor:pointer; transition:opacity 0.15s ease;
    display:inline-flex; align-items:center; gap:6px;
  }
  .cc-btn:disabled { opacity:0.38; cursor:not-allowed; }
  .cc-btn-primary   { background:#4f46e5; color:white; }
  .cc-btn-secondary { background:#10b981; color:white; }
  .cc-btn-amber     { background:#f59e0b; color:white; }
  .cc-btn-red       { background:#ef4444; color:white; }
  .cc-btn-gray      { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.7); }
  .cc-btn:hover:not(:disabled) { opacity:0.82; }

  .cc-btn-send {
    background:linear-gradient(to right,#079f82,#7c6edd);
    color:white; border:none; border-radius:8px;
    height:44px; font-size:14px; font-weight:600;
    cursor:pointer; width:100%; transition:opacity 0.15s ease;
  }
  .cc-btn-send:hover:not(:disabled) { opacity:0.85; }
  .cc-btn-send:disabled { opacity:0.32; cursor:not-allowed; }

  .cc-spinner {
    width:15px; height:15px;
    border:2px solid rgba(255,255,255,0.2);
    border-top-color:white; border-radius:50%;
    animation:cc-spin 0.7s linear infinite; display:inline-block; flex-shrink:0;
  }

  .cc-dot-pulse {
    width:7px; height:7px; border-radius:50%;
    animation:cc-pulse 1.4s ease-in-out infinite; flex-shrink:0;
  }

  .cc-progress-bar {
    width:100%; height:6px;
    background:rgba(255,255,255,0.08);
    border-radius:3px; overflow:hidden;
  }
  .cc-progress-fill {
    height:100%;
    background:linear-gradient(to right,#4f46e5,#10b981);
    border-radius:3px; transition:width 0.5s ease;
  }

  .cc-campaign-card {
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:10px; padding:14px 16px;
    margin-bottom:8px; transition:border-color 0.15s ease;
    cursor:pointer;
  }
  .cc-campaign-card:hover { border-color:rgba(255,255,255,0.14); }

  .cc-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 9px; border-radius:20px; font-size:11px; font-weight:600;
  }

  .cc-toast {
    position:fixed; bottom:24px; right:24px; z-index:10000;
    padding:12px 20px; border-radius:8px;
    font-size:13px; font-weight:500;
    animation:cc-toast 0.22s ease;
    box-shadow:0 4px 20px rgba(0,0,0,0.4); max-width:320px;
  }

  .cc-backdrop {
    position:fixed; inset:0; background:rgba(0,0,0,0.72);
    z-index:1000; display:flex; align-items:center;
    justify-content:center; padding:16px; box-sizing:border-box;
  }
  .cc-modal {
    background:#111827; border:1px solid rgba(255,255,255,0.1);
    border-radius:14px; width:100%; max-width:460px;
    padding:24px; box-shadow:0 20px 60px rgba(0,0,0,0.6);
  }

  /* Upload drop zone */
  .cc-dropzone {
    border:2px dashed rgba(255,255,255,0.15);
    border-radius:10px; padding:32px 20px;
    text-align:center; cursor:pointer;
    transition:all 0.2s ease; background:rgba(255,255,255,0.02);
  }
  .cc-dropzone:hover, .cc-dropzone.drag { border-color:#4f46e5; background:rgba(79,70,229,0.05); }

  /* Recipients preview table */
  .cc-recip {
    margin-top:12px; background:#1f2937;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; overflow:hidden;
    animation:cc-fadein 0.2s ease;
  }
  .cc-recip-hdr {
    padding:10px 14px; display:flex; align-items:center;
    justify-content:space-between; gap:8px;
    border-bottom:1px solid rgba(255,255,255,0.08);
    flex-wrap:wrap;
  }
  .cc-recip-table { width:100%; border-collapse:collapse; }
  .cc-recip-table th {
    padding:7px 10px; font-size:11px; font-weight:600;
    color:rgba(255,255,255,0.35); text-align:left;
    border-bottom:1px solid rgba(255,255,255,0.07);
  }
  .cc-recip-table td {
    height:36px; padding:0 10px; font-size:13px;
    border-bottom:1px solid rgba(255,255,255,0.04);
    vertical-align:middle; color:rgba(255,255,255,0.8);
  }
  .cc-recip-table tr:last-child td { border-bottom:none; }
  .cc-recip-table tr:hover td { background:rgba(255,255,255,0.03); }
  .cc-recip-pager {
    padding:8px 14px; display:flex; align-items:center;
    justify-content:center; gap:12px; font-size:12px;
    color:rgba(255,255,255,0.45); border-top:1px solid rgba(255,255,255,0.07);
  }

  /* Editor Modal */
  .cc-emod-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9998; }
  .cc-emod {
    position:fixed; top:50%; left:50%;
    transform:translate(-50%,-50%);
    width:1200px; max-width:95vw; height:85vh;
    background:#111827; border-radius:16px;
    border:1px solid rgba(255,255,255,0.1);
    display:flex; flex-direction:column; overflow:hidden;
    z-index:9999; box-shadow:0 20px 80px rgba(0,0,0,0.7);
  }
  .cc-emod-header {
    height:56px; padding:0 20px; flex-shrink:0;
    border-bottom:1px solid rgba(255,255,255,0.1);
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    box-sizing:border-box;
  }
  .cc-emod-body { display:flex; flex:1; overflow:hidden; }
  .cc-emod-left {
    width:45%; background:#0d1117;
    border-right:1px solid rgba(255,255,255,0.1);
    display:flex; flex-direction:column; overflow:hidden;
  }
  .cc-emod-right { flex:1; background:#f4f4f5; display:flex; flex-direction:column; }
  .cc-emod-ebar {
    height:32px; background:#161b22; flex-shrink:0;
    border-bottom:1px solid rgba(255,255,255,0.1);
    padding:0 12px; display:flex; align-items:center; gap:8px;
    font-size:11px; color:rgba(255,255,255,0.3);
  }
  .cc-emod-pbar {
    height:32px; background:#e5e7eb; flex-shrink:0;
    border-bottom:1px solid #d1d5db;
    padding:0 12px; display:flex; align-items:center;
    justify-content:space-between; font-size:11px; color:#6b7280;
  }
  .cc-emod-textarea {
    flex:1; background:transparent; color:#e6edf3;
    font-family:'Courier New',Consolas,monospace;
    font-size:13px; line-height:1.6; padding:16px;
    border:none; outline:none; resize:none;
    width:100%; box-sizing:border-box;
  }
  .cc-emod-iframe-wrap {
    flex:1; overflow-y:auto; padding:20px;
    display:flex; align-items:flex-start; justify-content:center;
    background:#f4f4f5;
  }
  .cc-emod-pill {
    height:30px; padding:0 14px; border-radius:6px;
    border:1px solid rgba(255,255,255,0.1); cursor:pointer;
    font-size:12px; font-weight:500; background:transparent;
    display:inline-flex; align-items:center; gap:5px; transition:all 0.15s;
  }
  .cc-emod-pill.active   { background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.9); }
  .cc-emod-pill.inactive { color:rgba(255,255,255,0.4); }
  .cc-emod-pill:hover    { color:rgba(255,255,255,0.8); }

  .cc-var-dropdown {
    position:absolute; right:0; top:calc(100% + 6px);
    background:#1a2235; border:1px solid rgba(255,255,255,0.1);
    border-radius:8px; min-width:220px; z-index:10001;
    box-shadow:0 8px 24px rgba(0,0,0,0.4); overflow:hidden;
  }
  .cc-var-item {
    display:flex; align-items:center; justify-content:space-between;
    padding:9px 14px; cursor:pointer; transition:background 0.1s ease;
    border:none; width:100%; background:transparent; text-align:left;
  }
  .cc-var-item:hover { background:rgba(255,255,255,0.06); }

  .cc-rich-toolbar {
    background:#1a2235; flex-shrink:0;
    border-bottom:1px solid rgba(255,255,255,0.08);
    padding:4px 8px; display:flex; align-items:center;
    gap:2px; flex-wrap:wrap;
  }
  .cc-rich-btn {
    width:28px; height:28px; border-radius:4px;
    display:inline-flex; align-items:center; justify-content:center;
    background:none; border:none; cursor:pointer;
    color:rgba(255,255,255,0.55); font-size:13px; font-weight:700;
    transition:all 0.1s; flex-shrink:0;
  }
  .cc-rich-btn:hover { background:rgba(255,255,255,0.1); color:white; }
  .cc-rich-sep { width:1px; height:16px; background:rgba(255,255,255,0.12); margin:0 3px; flex-shrink:0; }
  .cc-rich-iframe { flex:1; border:none; width:100%; background:white; display:block; min-height:0; }

  .cc-mode-toggle {
    display:inline-flex; background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.1); border-radius:6px; overflow:hidden;
  }
  .cc-mode-btn {
    padding:0 10px; height:22px; border:none; cursor:pointer;
    font-size:11px; font-weight:600; transition:all 0.15s;
    background:transparent; color:rgba(255,255,255,0.4);
  }
  .cc-mode-btn.active { background:rgba(255,255,255,0.12); color:rgba(255,255,255,0.9); }
  .cc-mode-btn:hover:not(.active) { color:rgba(255,255,255,0.7); }

  .cc-template-row {
    display:flex; align-items:center; justify-content:space-between;
    gap:12px; padding:14px 16px;
    background:rgba(255,255,255,0.03);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px;
  }

  .cc-section-label {
    font-size:11px; font-weight:700; color:rgba(255,255,255,0.35);
    text-transform:uppercase; letter-spacing:0.07em; margin:0 0 10px;
  }
  .cc-field-label {
    display:block; font-size:12px; font-weight:500;
    color:rgba(255,255,255,0.48); margin-bottom:6px;
  }
  .cc-divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:16px 0; }
  .cc-empty { text-align:center; padding:40px 20px; color:rgba(255,255,255,0.35); font-size:14px; }

  @media(max-width:767px) {
    .cc-emod { width:100vw; max-width:100vw; height:100vh; border-radius:0; top:0; left:0; transform:none; }
    .cc-emod-body { flex-direction:column; }
    .cc-emod-left { width:100%; border-right:none; }
    .cc-emod-panel-hidden { display:none !important; }
  }
  @media(min-width:768px) and (max-width:1199px) {
    .cc-emod { width:95vw; height:90vh; }
    .cc-emod-left { width:50%; }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function CsvEmailCampaigns() {
  const navigate = useNavigate();

  // View
  const [view, setView] = useState<'list' | 'create'>('list');

  // Form state
  const [campaignName, setCampaignName]   = useState('');
  const [subject, setSubject]             = useState('');
  const [ratePerHour, setRatePerHour]     = useState(100);
  const [htmlContent, setHtmlContent]     = useState(DEFAULT_TEMPLATE);
  const [templateSaved, setTemplateSaved] = useState(false);

  // File upload
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState('');
  const [recipients, setRecipients]       = useState<Recipient[]>([]);
  const [parseErrors, setParseErrors]     = useState<string[]>([]);
  const [extraColumns, setExtraColumns]   = useState<string[]>([]);
  const [isDragging, setIsDragging]       = useState(false);
  const [recipPage, setRecipPage]         = useState(1);
  const RECIP_PAGE_SIZE = 8;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor modal
  const [editorOpen, setEditorOpen]             = useState(false);
  const [pendingHtml, setPendingHtml]           = useState('');
  const [pendingPreviewHtml, setPendingPreviewHtml] = useState('');
  const [editorMode, setEditorMode]             = useState<'html' | 'rich'>('html');
  const [previewMode, setPreviewMode]           = useState<'desktop' | 'mobile'>('desktop');
  const [modalTab, setModalTab]                 = useState<'html' | 'preview'>('html');
  const [varDropdownOpen, setVarDropdownOpen]   = useState(false);
  const [copiedVar, setCopiedVar]               = useState('');
  const htmlOnOpenRef   = useRef('');
  const varBtnRef       = useRef<HTMLDivElement>(null);
  const richEditorRef   = useRef<HTMLIFrameElement>(null);
  const richTimerRef    = useRef<ReturnType<typeof setTimeout>>();
  const pendingHtmlRef  = useRef(pendingHtml);

  // Confirm send modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating]       = useState(false);
  const [sendAfterCreate, setSendAfterCreate] = useState(false);

  // Campaign list
  const [campaigns, setCampaigns]               = useState<CsvCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const hasRunningRef = useRef(false);

  // ── Sync ref ──────────────────────────────────────────────────────────────
  useEffect(() => { pendingHtmlRef.current = pendingHtml; }, [pendingHtml]);

  // ── Debounced preview ────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setPendingPreviewHtml(buildPreview(pendingHtml)), 300);
    return () => clearTimeout(id);
  }, [pendingHtml]);

  // ── Rich editor init ─────────────────────────────────────────────────────
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
      clearTimeout(richTimerRef.current);
      richTimerRef.current = setTimeout(() => {
        const body = doc.body;
        if (body) {
          const updated = pendingHtmlRef.current.replace(
            /(<body[^>]*>)([\s\S]*)(<\/body>)/i,
            `$1${body.innerHTML}$3`
          );
          setPendingHtml(updated);
        }
      }, 300);
    };
    doc.addEventListener('input', handleInput);
    return () => doc.removeEventListener('input', handleInput);
  }, [editorMode, editorOpen]);

  // ── Close var dropdown on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (varBtnRef.current && !varBtnRef.current.contains(e.target as Node)) {
        setVarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Load campaigns ────────────────────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns?limit=50`, {
        headers: apiHeaders(),
      });
      const data = await res.json();
      setCampaigns(data.campaigns || []);
      hasRunningRef.current = (data.campaigns || []).some((c: CsvCampaign) => c.status === 'running');
    } catch {
      // silent
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // ── Poll when running ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (hasRunningRef.current) loadCampaigns();
    }, 10_000);
    return () => clearInterval(id);
  }, [loadCampaigns]);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── File upload ───────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setUploadError('');
    setParseErrors([]);
    setRecipients([]);
    setRecipPage(1);

    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setUploadError('Only CSV and Excel files (.csv, .xlsx, .xls) are accepted.');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns/parse`, {
        method: 'POST',
        headers: { 'x-api-key': EMAIL_API_KEY },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Failed to parse file');
        return;
      }
      setRecipients(data.recipients || []);
      setParseErrors(data.errors || []);
      setExtraColumns(data.columns || []);
      if ((data.recipients || []).length === 0) {
        setUploadError('No valid recipients found. Make sure the file has "name" and "email" columns.');
      }
    } catch {
      setUploadError('Upload failed. Check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Editor modal ──────────────────────────────────────────────────────────
  const openEditor = () => {
    setPendingHtml(htmlContent);
    setPendingPreviewHtml(buildPreview(htmlContent));
    htmlOnOpenRef.current = htmlContent;
    setEditorMode('html');
    setPreviewMode('desktop');
    setModalTab('html');
    setEditorOpen(true);
  };

  const saveEditor = () => {
    setHtmlContent(pendingHtml);
    setTemplateSaved(true);
    setEditorOpen(false);
  };

  const insertVar = (key: string) => {
    setVarDropdownOpen(false);
    if (editorMode === 'rich') {
      const iframe = richEditorRef.current;
      if (iframe?.contentDocument) {
        iframe.contentDocument.execCommand('insertText', false, key);
      }
      return;
    }
    const ta = document.getElementById('cc-html-textarea') as HTMLTextAreaElement;
    if (!ta) return;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = pendingHtml.slice(0, start) + key + pendingHtml.slice(end);
    setPendingHtml(next);
    setTimeout(() => {
      ta.setSelectionRange(start + key.length, start + key.length);
      ta.focus();
    }, 0);
    setCopiedVar(key);
    setTimeout(() => setCopiedVar(''), 1500);
  };

  const richCmd = (cmd: string, val?: string) => {
    richEditorRef.current?.contentDocument?.execCommand(cmd, false, val);
  };

  // ── Create campaign ───────────────────────────────────────────────────────
  const handleCreate = async (sendNow: boolean) => {
    setCreating(true);
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns`, {
        method: 'POST',
        headers: apiHeaders(true),
        body: JSON.stringify({
          name: campaignName.trim(),
          subject: subject.trim(),
          htmlContent,
          ratePerHour,
          recipients,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to create campaign', false);
        return;
      }

      if (sendNow) {
        const sendRes = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns/${data._id}/send`, {
          method: 'POST',
          headers: apiHeaders(),
        });
        const sendData = await sendRes.json();
        if (!sendRes.ok) {
          showToast(sendData.error || 'Campaign created but failed to send', false);
        } else {
          showToast(`Campaign started — sending to ${sendData.totalTargeted} recipients`);
        }
      } else {
        showToast('Campaign saved as draft');
      }

      // Reset form
      setCampaignName('');
      setSubject('');
      setRatePerHour(100);
      setHtmlContent(DEFAULT_TEMPLATE);
      setTemplateSaved(false);
      setRecipients([]);
      setParseErrors([]);
      setExtraColumns([]);
      setUploadError('');
      setView('list');
      loadCampaigns();
    } catch {
      showToast('Network error. Please try again.', false);
    } finally {
      setCreating(false);
      setConfirmOpen(false);
    }
  };

  // ── Pause / Resume / Stop ─────────────────────────────────────────────────
  const doAction = async (id: string, action: 'pause' | 'resume' | 'stop', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns/${id}/${action}`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || `Failed to ${action}`, false); return; }
      showToast(data.message || `Campaign ${action}d`);
      loadCampaigns();
    } catch {
      showToast('Network error', false);
    }
  };

  const doSend = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${EMAIL_SERVICE_URL}/csv-campaigns/${id}/send`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to send', false); return; }
      showToast(`Campaign started — ${data.totalTargeted} recipients`);
      loadCampaigns();
    } catch {
      showToast('Network error', false);
    }
  };

  // ── Form validation ───────────────────────────────────────────────────────
  const canCreate = campaignName.trim() && subject.trim() && recipients.length > 0 && templateSaved;

  // ── Recipient pagination ──────────────────────────────────────────────────
  const recipTotalPages = Math.ceil(recipients.length / RECIP_PAGE_SIZE);
  const recipSlice = recipients.slice((recipPage - 1) * RECIP_PAGE_SIZE, recipPage * RECIP_PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>

      {/* ── Campaign list ── */}
      {view === 'list' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white' }}>Bulk Email Campaigns</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                Send emails to custom lists uploaded via CSV or Excel
              </p>
            </div>
            <button className="cc-btn cc-btn-primary" onClick={() => setView('create')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
              </svg>
              New Campaign
            </button>
          </div>

          {/* List */}
          <div className="cc-card">
            <p className="cc-section-label">Campaign History</p>

            {campaignsLoading && campaigns.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                <div className="cc-spinner" />
                Loading campaigns...
              </div>
            )}

            {!campaignsLoading && campaigns.length === 0 && (
              <div className="cc-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                No bulk campaigns yet. Create your first one.
              </div>
            )}

            {campaigns.map((c) => {
              const meta = STATUS_META[c.status] || STATUS_META.draft;
              const total = c.totalTargeted || 0;
              const done  = (c.sentCount || 0) + (c.failedCount || 0);
              const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
              const pending = Math.max(0, total - done);

              return (
                <div
                  key={c._id}
                  className="cc-campaign-card"
                  onClick={() => navigate(`/csv-campaigns/${c._id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'white', wordBreak: 'break-word' }}>{c.name}</span>
                        <span className="cc-badge" style={{ background: `${meta.color}22`, color: meta.color }}>
                          {c.status === 'running' && <div className="cc-dot-pulse" style={{ background: meta.color }} />}
                          {meta.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                        {c.subject} · Created {fmtDate(c.createdAt)}
                      </div>

                      <div className="cc-progress-bar" style={{ marginBottom: 6 }}>
                        <div className="cc-progress-fill" style={{ width: `${pct}%` }} />
                      </div>

                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.45)', flexWrap: 'wrap' }}>
                        <span>Total: <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{total}</strong></span>
                        <span style={{ color: '#10b981' }}>Sent: <strong>{c.sentCount}</strong></span>
                        <span style={{ color: '#ef4444' }}>Failed: <strong>{c.failedCount}</strong></span>
                        <span>Pending: <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{pending}</strong></span>
                        <span>Rate: <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{c.ratePerHour}/hr</strong></span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      {c.status === 'draft' && (
                        <button className="cc-btn cc-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={(e) => doSend(c._id, e)}>
                          Send
                        </button>
                      )}
                      {c.status === 'running' && (
                        <button className="cc-btn cc-btn-amber" style={{ padding: '6px 12px', fontSize: 12 }} onClick={(e) => doAction(c._id, 'pause', e)}>
                          Pause
                        </button>
                      )}
                      {c.status === 'paused' && (
                        <button className="cc-btn cc-btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={(e) => doAction(c._id, 'resume', e)}>
                          Resume
                        </button>
                      )}
                      {['running', 'paused'].includes(c.status) && (
                        <button className="cc-btn cc-btn-red" style={{ padding: '6px 12px', fontSize: 12 }} onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm('Stop this campaign? Pending emails will be cancelled.')) {
                            doAction(c._id, 'stop', e);
                          }
                        }}>
                          Stop
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {view === 'create' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button className="cc-btn cc-btn-gray" onClick={() => setView('list')} style={{ padding: '6px 12px', fontSize: 12 }}>
              ← Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>New Bulk Email Campaign</h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Upload a CSV or Excel file with Name and Email columns</p>
            </div>
          </div>

          <div className="cc-layout">
            {/* Left — form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* File upload */}
              <div className="cc-card">
                <p className="cc-section-label">Recipients File</p>

                <div
                  className={`cc-dropzone${isDragging ? ' drag' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    style={{ display: 'none' }}
                    onChange={onFileInput}
                  />
                  {uploading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div className="cc-spinner" style={{ width: 24, height: 24 }} />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Parsing file...</span>
                    </div>
                  ) : (
                    <>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" style={{ margin: '0 auto 10px', display: 'block' }}>
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                        Drop file here or click to upload
                      </p>
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                        CSV or Excel (.csv, .xlsx, .xls) · Columns: <code style={{ color: '#818cf8' }}>name</code>, <code style={{ color: '#818cf8' }}>email</code>
                      </p>
                    </>
                  )}
                </div>

                {uploadError && (
                  <p style={{ marginTop: 10, fontSize: 13, color: '#ef4444' }}>{uploadError}</p>
                )}

                {parseErrors.length > 0 && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>{parseErrors.length} row(s) skipped:</p>
                    {parseErrors.slice(0, 3).map((e, i) => (
                      <p key={i} style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{e}</p>
                    ))}
                    {parseErrors.length > 3 && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>+{parseErrors.length - 3} more</p>
                    )}
                  </div>
                )}

                {/* Recipients preview */}
                {recipients.length > 0 && (
                  <div className="cc-recip">
                    <div className="cc-recip-hdr">
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>
                        {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} found
                      </span>
                      <button className="cc-btn cc-btn-gray" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => { setRecipients([]); setParseErrors([]); setExtraColumns([]); setUploadError(''); }}>
                        Clear
                      </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                    <table className="cc-recip-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Email</th>
                          {extraColumns.map((col: string) => <th key={col}>{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {recipSlice.map((r, i) => (
                          <tr key={i}>
                            <td style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{(recipPage - 1) * RECIP_PAGE_SIZE + i + 1}</td>
                            <td>{r.name || <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>}</td>
                            <td style={{ color: 'rgba(255,255,255,0.6)' }}>{r.email}</td>
                            {extraColumns.map((col: string) => (
                              <td key={col} style={{ color: 'rgba(255,255,255,0.55)' }}>
                                {r.customFields?.[col] || <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {recipTotalPages > 1 && (
                      <div className="cc-recip-pager">
                        <button className="cc-btn cc-btn-gray" style={{ padding: '3px 10px', fontSize: 12 }} disabled={recipPage === 1} onClick={() => setRecipPage(p => p - 1)}>‹</button>
                        <span>Page {recipPage} of {recipTotalPages}</span>
                        <button className="cc-btn cc-btn-gray" style={{ padding: '3px 10px', fontSize: 12 }} disabled={recipPage === recipTotalPages} onClick={() => setRecipPage(p => p + 1)}>›</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Campaign details */}
              <div className="cc-card">
                <p className="cc-section-label">Campaign Details</p>

                <label className="cc-field-label">Campaign Name</label>
                <input
                  className="cc-input"
                  placeholder="e.g. April Outreach 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  style={{ marginBottom: 12 }}
                />

                <label className="cc-field-label">Email Subject</label>
                <input
                  className="cc-input"
                  placeholder="e.g. A message from Collabscafe"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ marginBottom: 12 }}
                />

                <label className="cc-field-label">Rate (emails / hour)</label>
                <input
                  className="cc-input"
                  type="number"
                  min={1}
                  max={3600}
                  value={ratePerHour}
                  onChange={(e) => setRatePerHour(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <p style={{ margin: '6px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                  1 email every {Math.round(3600 / ratePerHour)}s · {recipients.length} recipients ≈ {recipients.length > 0 ? `${Math.ceil(recipients.length / ratePerHour * 60)}m` : '—'} total
                </p>
              </div>

              {/* Template */}
              <div className="cc-card">
                <p className="cc-section-label">Email Template</p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  Available variables: <code style={{ color: '#818cf8' }}>{'{{first_name}}'}</code> <code style={{ color: '#818cf8' }}>{'{{name}}'}</code> <code style={{ color: '#818cf8' }}>{'{{email}}'}</code>
                </p>

                <div className="cc-template-row">
                  <div>
                    <p style={{ margin: 0, fontSize: 13, color: 'white', fontWeight: 500 }}>
                      {templateSaved ? 'Template ready' : 'Default template loaded'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {templateSaved ? 'Custom HTML saved' : 'Click Edit to customise'}
                    </p>
                  </div>
                  <button className="cc-btn cc-btn-primary" style={{ padding: '7px 14px', fontSize: 12 }} onClick={openEditor}>
                    {templateSaved ? 'Edit Template' : 'Edit Template'}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="cc-btn cc-btn-gray"
                  style={{ flex: 1, justifyContent: 'center', height: 44 }}
                  disabled={!canCreate || creating}
                  onClick={() => { setSendAfterCreate(false); setConfirmOpen(true); }}
                >
                  Save as Draft
                </button>
                <button
                  className="cc-btn-send"
                  style={{ flex: 2 }}
                  disabled={!canCreate || creating}
                  onClick={() => { setSendAfterCreate(true); setConfirmOpen(true); }}
                >
                  {creating ? <><div className="cc-spinner" />Creating...</> : `Create & Send to ${recipients.length} recipients`}
                </button>
              </div>

              {!templateSaved && recipients.length > 0 && campaignName && subject && (
                <p style={{ margin: 0, fontSize: 12, color: '#f59e0b', textAlign: 'center' }}>
                  Click "Edit Template" and save to enable sending
                </p>
              )}
            </div>

            {/* Right — live preview */}
            <div className="cc-card" style={{ position: 'sticky', top: 20 }}>
              <p className="cc-section-label">Template Preview</p>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
                <iframe
                  srcDoc={buildPreview(htmlContent)}
                  style={{ width: '100%', height: 480, border: 'none', display: 'block', background: '#f4f4f5' }}
                  title="Email preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirmOpen && (
        <div className="cc-backdrop" onClick={() => setConfirmOpen(false)}>
          <div className="cc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', color: 'white', fontSize: 16 }}>
              {sendAfterCreate ? 'Create & Send Campaign?' : 'Save as Draft?'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              {sendAfterCreate
                ? `"${campaignName}" will be sent to ${recipients.length} recipients at ${ratePerHour} emails/hour.`
                : `"${campaignName}" will be saved as a draft. You can send it later.`}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="cc-btn cc-btn-gray" onClick={() => setConfirmOpen(false)} disabled={creating}>Cancel</button>
              <button
                className="cc-btn cc-btn-primary"
                disabled={creating}
                onClick={() => handleCreate(sendAfterCreate)}
              >
                {creating ? <><div className="cc-spinner" />Working...</> : sendAfterCreate ? 'Send Now' : 'Save Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor modal ── */}
      {editorOpen && (
        <>
          <div className="cc-emod-overlay" onClick={() => {
            if (pendingHtml !== htmlOnOpenRef.current) {
              if (!window.confirm('Discard unsaved changes?')) return;
            }
            setEditorOpen(false);
          }} />
          <div className="cc-emod">
            {/* Header */}
            <div className="cc-emod-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>Edit Email Template</span>
                <div className="cc-mode-toggle">
                  <button className={`cc-mode-btn${editorMode === 'html' ? ' active' : ''}`} onClick={() => setEditorMode('html')}>HTML</button>
                  <button className={`cc-mode-btn${editorMode === 'rich' ? ' active' : ''}`} onClick={() => setEditorMode('rich')}>Rich Text</button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Insert variable */}
                <div ref={varBtnRef} style={{ position: 'relative' }}>
                  <button className="cc-emod-pill inactive" onClick={() => setVarDropdownOpen(v => !v)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Insert Variable
                  </button>
                  {varDropdownOpen && (
                    <div className="cc-var-dropdown">
                      {[...BASE_VARS, ...extraColumns.map((c: string) => ({ key: `{{${c}}}`, label: c }))].map((v) => (
                        <button key={v.key} className="cc-var-item" onClick={() => insertVar(v.key)}>
                          <span style={{ fontSize: 12, color: '#818cf8', fontFamily: 'monospace' }}>{v.key}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{copiedVar === v.key ? '✓ inserted' : v.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Preview toggle */}
                <button className={`cc-emod-pill${previewMode === 'desktop' ? ' active' : ' inactive'}`} onClick={() => setPreviewMode('desktop')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  Desktop
                </button>
                <button className={`cc-emod-pill${previewMode === 'mobile' ? ' active' : ' inactive'}`} onClick={() => setPreviewMode('mobile')}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  Mobile
                </button>
                {/* Save */}
                <button className="cc-btn cc-btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={saveEditor}>
                  Save Template
                </button>
                <button className="cc-btn cc-btn-gray" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                  if (pendingHtml !== htmlOnOpenRef.current && !window.confirm('Discard changes?')) return;
                  setEditorOpen(false);
                }}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div className="cc-emod-body">
              {/* Left — editor */}
              <div className={`cc-emod-left${window.innerWidth < 768 && modalTab === 'preview' ? ' cc-emod-panel-hidden' : ''}`}>
                <div className="cc-emod-ebar">
                  <span>HTML</span>
                  <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)' }}>{pendingHtml.length} chars</span>
                </div>

                {editorMode === 'html' ? (
                  <textarea
                    id="cc-html-textarea"
                    className="cc-emod-textarea"
                    value={pendingHtml}
                    onChange={(e) => setPendingHtml(e.target.value)}
                    spellCheck={false}
                  />
                ) : (
                  <>
                    <div className="cc-rich-toolbar">
                      <button className="cc-rich-btn" title="Bold" onClick={() => richCmd('bold')}><b>B</b></button>
                      <button className="cc-rich-btn" title="Italic" onClick={() => richCmd('italic')}><i>I</i></button>
                      <button className="cc-rich-btn" title="Underline" onClick={() => richCmd('underline')}><u>U</u></button>
                      <div className="cc-rich-sep" />
                      <button className="cc-rich-btn" title="H1" onClick={() => richCmd('formatBlock', 'h1')} style={{ fontSize: 11 }}>H1</button>
                      <button className="cc-rich-btn" title="H2" onClick={() => richCmd('formatBlock', 'h2')} style={{ fontSize: 11 }}>H2</button>
                      <button className="cc-rich-btn" title="Paragraph" onClick={() => richCmd('formatBlock', 'p')} style={{ fontSize: 11 }}>P</button>
                      <div className="cc-rich-sep" />
                      <button className="cc-rich-btn" title="Align left" onClick={() => richCmd('justifyLeft')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                      </button>
                      <button className="cc-rich-btn" title="Align center" onClick={() => richCmd('justifyCenter')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                      </button>
                      <div className="cc-rich-sep" />
                      <button className="cc-rich-btn" title="Unordered list" onClick={() => richCmd('insertUnorderedList')} style={{ fontSize: 14 }}>•</button>
                      <button className="cc-rich-btn" title="Ordered list" onClick={() => richCmd('insertOrderedList')} style={{ fontSize: 11 }}>1.</button>
                      <div className="cc-rich-sep" />
                      <button className="cc-rich-btn" title="Link" onClick={() => { const url = prompt('Enter URL:'); if (url) richCmd('createLink', url); }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                      </button>
                    </div>
                    <iframe ref={richEditorRef} className="cc-rich-iframe" title="Rich editor" />
                  </>
                )}
              </div>

              {/* Right — preview */}
              <div className={`cc-emod-right${window.innerWidth < 768 && modalTab === 'html' ? ' cc-emod-panel-hidden' : ''}`}>
                <div className="cc-emod-pbar">
                  <span>Preview</span>
                  <span style={{ color: previewMode === 'mobile' ? '#4f46e5' : '#6b7280' }}>
                    {previewMode === 'mobile' ? '390px' : '600px'}
                  </span>
                </div>
                <div className="cc-emod-iframe-wrap">
                  <iframe
                    srcDoc={pendingPreviewHtml}
                    style={{
                      width: previewMode === 'mobile' ? 390 : '100%',
                      maxWidth: '100%',
                      border: 'none',
                      borderRadius: 8,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                      minHeight: 400,
                      background: 'white',
                    }}
                    title="Preview"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="cc-toast" style={{ background: toast.ok ? '#10b981' : '#ef4444', color: 'white' }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
