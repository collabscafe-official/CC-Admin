// Headers for the analytics and email services.
// Sends the admin login token (verified by those services) plus the old
// x-api-key during the transition. Once both services have
// ALLOW_LEGACY_API_KEY turned off, the key can be removed from the config
// files: it ships in this app's JavaScript, so it was never a secret.
export function adminServiceHeaders(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (apiKey) h['x-api-key'] = apiKey;
  try {
    const raw = localStorage.getItem('dashboard-user');
    const token = raw ? JSON.parse(raw)?.token : null;
    if (token) h['Authorization'] = `Bearer ${token}`;
  } catch {
    // no stored session: the service will answer 401
  }
  return h;
}
