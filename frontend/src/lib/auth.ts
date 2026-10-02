import Cookies from 'js-cookie';
import { User } from '@/types/user';

const LEGACY_TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const TIMER_TARGET_PREFIX = 'tino_timer_target_minutes';

let authClearVersion = 0;

export function getToken(): string | null {
  try {
    return Cookies.get(LEGACY_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(_token: string): void {
  // No-op as tokens are now handled by server
}

export function clearToken(): void {
  try {
    Cookies.remove(LEGACY_TOKEN_KEY, { path: '/' });
  } catch {}
}

export function getStoredUser(): User | null {
  let userStr: string | undefined;
  try {
    userStr = Cookies.get(USER_KEY);
  } catch {
    return null;
  }
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  try {
    Cookies.set(USER_KEY, JSON.stringify(user), {
      secure: true,
      sameSite: 'strict',
    });
  } catch {}
}

export function clearStoredUser(): void {
  try {
    Cookies.remove(USER_KEY, { path: '/' });
  } catch {}
}

export function clearAllAuth(): void {
  authClearVersion += 1;
  clearToken();
  try {
    Cookies.remove(USER_KEY, { path: '/' });
    Cookies.remove(TIMER_TARGET_PREFIX, { path: '/' });
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TIMER_TARGET_PREFIX);

      Object.keys(localStorage)
        .filter((key) => key.startsWith(`${TIMER_TARGET_PREFIX}_`))
        .forEach((key) => localStorage.removeItem(key));
    } catch {}

    try {
      document.cookie
        .split(';')
        .map((cookie) => cookie.split('=')[0]?.trim())
        .filter((name) => name?.startsWith(`${TIMER_TARGET_PREFIX}_`))
        .forEach((name) => Cookies.remove(name, { path: '/' }));
    } catch {}

    try {
      window.dispatchEvent(new Event('auth:cleared'));
    } catch {}

    try {
      localStorage.setItem('auth_clear_event', String(Date.now()));
    } catch {}
  }
}

export function getAuthClearVersion(): number {
  return authClearVersion;
}

export function isAdmin(user: User | null | undefined): boolean {
  const role = user?.role?.trim();
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

export function isSuperAdmin(user: User | null | undefined): boolean {
  return user?.role?.trim() === 'SUPERADMIN';
}

export function isOrgOwner(
  user: User | null | undefined,
  userRole: string | null | undefined,
): boolean {
  if (isAdmin(user)) return true;
  return userRole === 'ORG_OWNER';
}

export function canManageProject(
  user: User | null | undefined,
  userRole: string | null | undefined,
  project: { ownerId: string } | null | undefined,
): boolean {
  if (isOrgOwner(user, userRole)) return true;
  return !!project && project.ownerId === user?.id;
}
