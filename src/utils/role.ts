// Admin roles. `super_admin` = everything. `team` = view-only Admin + Tasks + Leads
// (sales interns, future staff). The server enforces this; the UI only hides
// what a team login can't use.

// Sidebar names + paths a team login can open.
export const TEAM_SCREENS = ['Dashboard', 'Tasks', 'Insights', 'Influencers', 'Brands', 'Brand Activity', 'Leads', 'Collabs', 'Campaigns'];
const TEAM_PATHS = ['/dashboard', '/tasks', '/insights', '/influencers', '/brands', '/brand-activity', '/leads', '/collabs', '/campaigns'];

// Older sessions stored before roles existed have no `type`: they are the
// super admin (the only account then).
export function isTeamUser(user?: any): boolean {
  let u = user;
  if (!u) {
    try { u = JSON.parse(localStorage.getItem('dashboard-user') || 'null'); } catch { u = null; }
  }
  return u?.type === 'team';
}

// Screens a team login may be given on top of the default set (per account,
// via the `screens` list on the admin; see Backend-V2 create-team-admin.js).
const TEAM_OPTIONAL_SCREENS = ['Top Creators'];

// The sidebar items this team login sees: its own `screens` list when set
// (limited to screens a team login is allowed), otherwise the default set.
export function teamScreensFor(user?: any): string[] {
  const own: string[] = Array.isArray(user?.screens) ? user.screens : [];
  if (!own.length) return TEAM_SCREENS;
  const allowed = [...TEAM_SCREENS, ...TEAM_OPTIONAL_SCREENS];
  return own.filter(s => allowed.includes(s));
}

export function teamCanOpen(pathname: string): boolean {
  return TEAM_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}
