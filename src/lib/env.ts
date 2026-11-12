// Reads environment variables lazily (never at import time) so the build works with none set.

export type Mode = 'live' | 'mock';

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Mock (demo) mode when BRIDGE_MODE=mock. When BRIDGE_MODE is unset, mock mode applies only if BRIDGE_URL is missing
 * AND the app is not running in production: in production a missing BRIDGE_URL is "Setup incomplete", never demo data.
 */
export function getMode(): Mode {
  const m = (process.env.BRIDGE_MODE ?? '').trim().toLowerCase();
  if (m === 'mock') return 'mock';
  if (m === 'live') return 'live';
  if (!process.env.BRIDGE_URL && process.env.NODE_ENV !== 'production') return 'mock';
  return 'live';
}

export const isMock = () => getMode() === 'mock';

export function appTimezone(): string {
  return process.env.APP_TIMEZONE?.trim() || 'America/Toronto';
}

const AUTH_VARS = ['TV_KEY', 'AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'ALLOWED_DOMAIN', 'OWNER_EMAILS'];
const BRIDGE_VARS = ['BRIDGE_URL', 'BRIDGE_SECRET'];

/** Names of required variables that are missing. Empty in development demo mode (R10 allows only that bypass). */
export function missingEnv(): string[] {
  if (isDevelopment() && isMock()) return [];
  const need = isMock() ? AUTH_VARS : [...BRIDGE_VARS, ...AUTH_VARS];
  return need.filter((n) => !process.env[n]?.trim());
}

export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}
