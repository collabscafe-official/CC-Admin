import React, { useEffect, useState } from 'react';
import ANALYTICS_CONFIG from '../config/analyticsService';

const BASE = ANALYTICS_CONFIG.BASE_URL;
const API_KEY = ANALYTICS_CONFIG.API_KEY;

interface QuotaResponse {
  shouldMonitor: boolean;
  activeCreators?: number;
  threshold?: number;
  status?: 'ok' | 'warning' | 'critical' | 'unknown';
  tokensPerDay?: { consumed: number; remaining: number; limit: number; percentUsed: number };
  tokensPerHour?: { consumed: number; remaining: number; limit: number; percentUsed: number };
  tokensPerProjectPerHour?: { consumed: number; remaining: number; limit: number; percentUsed: number };
  dailyResetInMinutes?: number;
  hourlyResetInMinutes?: number;
  lastChecked?: string;
  message?: string;
}

function fmtResetTime(minutes?: number): string {
  if (minutes == null) return 'unknown';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const Ga4QuotaAlert: React.FC = () => {
  const [data, setData] = useState<QuotaResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE}/social/admin/ga4-quota`, {
          headers: { 'x-api-key': API_KEY },
        });
        if (!res.ok) return;
        const body = (await res.json()) as QuotaResponse;
        setData(body);
      } catch {
        // silent: this is a best-effort warning
      }
    })();
  }, []);

  if (!data) return null;
  if (!data.shouldMonitor) return null;           // < 5K active creators
  if (data.status === 'ok') return null;          // healthy, no alert
  if (data.status === 'unknown') return null;     // no data yet this session

  const isCritical = data.status === 'critical';

  const dayPct = data.tokensPerDay?.percentUsed ?? 0;
  const hourPct = Math.max(data.tokensPerHour?.percentUsed ?? 0, data.tokensPerProjectPerHour?.percentUsed ?? 0);
  const higher = dayPct >= hourPct ? 'daily' : 'hourly';
  const higherPct = Math.max(dayPct, hourPct).toFixed(1);
  const resetMin = higher === 'daily' ? data.dailyResetInMinutes : data.hourlyResetInMinutes;

  const styles = isCritical
    ? {
        border: 'border-red-500/40',
        bg: 'bg-red-500/10',
        icon: 'text-red-400',
        text: 'text-red-200',
      }
    : {
        border: 'border-yellow-500/40',
        bg: 'bg-yellow-500/10',
        icon: 'text-yellow-400',
        text: 'text-yellow-200',
      };

  return (
    <div className={`mb-4 px-4 py-3 border ${styles.border} ${styles.bg} rounded-lg flex items-start gap-3`}>
      <i className={`fas ${isCritical ? 'fa-exclamation-triangle' : 'fa-exclamation-circle'} ${styles.icon} mt-0.5`} />
      <div className={`flex-1 text-sm ${styles.text}`}>
        <div className="font-semibold mb-0.5">
          {isCritical ? 'GA4 API quota critical' : 'GA4 API quota warning'}
          <span className="ml-2 font-normal opacity-80">
            ({higher} at {higherPct}%)
          </span>
        </div>
        <div className="text-xs opacity-90">
          Resets in {fmtResetTime(resetMin)}
          {data.tokensPerDay && (
            <> · Daily: {data.tokensPerDay.consumed.toLocaleString()} / {data.tokensPerDay.limit.toLocaleString()}</>
          )}
          {data.tokensPerHour && (
            <> · Hourly: {data.tokensPerHour.consumed.toLocaleString()} / {data.tokensPerHour.limit.toLocaleString()}</>
          )}
        </div>
      </div>
    </div>
  );
};

export default Ga4QuotaAlert;
