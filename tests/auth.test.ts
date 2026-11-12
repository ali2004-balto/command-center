// Sign-in rules, roles, guards, and the production no-bypass rule (R10).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/session', async (orig) => {
  const real = await orig<typeof import('@/lib/auth/session')>();
  return { ...real, getActor: vi.fn() };
});

import { authorizeGoogleProfile } from '@/lib/auth/authorize';
import { ALL_CAPABILITIES, CAPABILITIES, can } from '@/lib/auth/roles';
import { AccessDenied, requireCapability, requireOwner } from '@/lib/auth/guards';
import * as session from '@/lib/auth/session';
import { missingEnv } from '@/lib/env';

const cfg = { allowedDomain: 'example.com', ownerEmails: ['Owner@Example.com'] };
const good = { email: 'owner@example.com', email_verified: true, hd: 'example.com' };

describe('authorizeGoogleProfile', () => {
  it('accepts the owner (case-insensitive)', () => {
    expect(authorizeGoogleProfile(good, cfg)).toBe(true);
    expect(authorizeGoogleProfile({ ...good, email: 'OWNER@example.com' }, cfg)).toBe(true);
  });
  it('refuses another address at the same domain', () => {
    expect(authorizeGoogleProfile({ ...good, email: 'someone@example.com' }, cfg)).toBe(false);
  });
  it('refuses an outside domain, even with the owner local part', () => {
    expect(authorizeGoogleProfile({ email: 'owner@gmail.com', email_verified: true, hd: 'gmail.com' }, cfg)).toBe(false);
    expect(authorizeGoogleProfile({ email: 'owner@gmail.com', email_verified: true, hd: 'example.com' }, cfg)).toBe(false);
  });
  it('refuses an unverified email', () => {
    expect(authorizeGoogleProfile({ ...good, email_verified: false }, cfg)).toBe(false);
    expect(authorizeGoogleProfile({ ...good, email_verified: undefined }, cfg)).toBe(false);
  });
  it('refuses a missing hd', () => {
    expect(authorizeGoogleProfile({ ...good, hd: undefined }, cfg)).toBe(false);
  });
  it('refuses look-alike domains', () => {
    const c = { allowedDomain: 'example.com', ownerEmails: ['owner@example.com.evil.io', 'owner@notexample.com'] };
    expect(authorizeGoogleProfile({ email: 'owner@example.com.evil.io', email_verified: true, hd: 'example.com.evil.io' }, c)).toBe(false);
    expect(authorizeGoogleProfile({ email: 'owner@notexample.com', email_verified: true, hd: 'example.com' }, c)).toBe(false);
  });
  it('refuses everything when nothing is configured', () => {
    expect(authorizeGoogleProfile(good, { allowedDomain: '', ownerEmails: [] })).toBe(false);
    expect(authorizeGoogleProfile(null, cfg)).toBe(false);
  });
});

describe('roles', () => {
  it('gives owner everything, tv only view_tv, field_staff nothing', () => {
    expect(CAPABILITIES.owner).toEqual(ALL_CAPABILITIES);
    expect(CAPABILITIES.tv).toEqual(['view_tv']);
    expect(CAPABILITIES.field_staff).toHaveLength(0);
    for (const c of ALL_CAPABILITIES) expect(can('field_staff', c)).toBe(false);
    expect(can(null, 'view_tv')).toBe(false);
  });
});

describe('guards', () => {
  const getActor = vi.mocked(session.getActor);
  it('deny with no session (redirect to sign-in)', async () => {
    getActor.mockResolvedValue(null);
    await expect(requireOwner()).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') });
    await expect(requireCapability('change_switches')).rejects.toBeDefined();
  });
  it('deny when the only credential is a TV role', async () => {
    getActor.mockResolvedValue({ role: 'tv', email: '' } as any);
    await expect(requireOwner()).rejects.toBeDefined();
    getActor.mockResolvedValue({ role: 'field_staff', email: 'x@example.com' } as any);
    await expect(requireCapability('dismiss_items')).rejects.toBeDefined();
  });
  it('allow the owner', async () => {
    getActor.mockResolvedValue({ role: 'owner', email: 'owner@example.com' });
    await expect(requireCapability('change_switches')).resolves.toMatchObject({ role: 'owner' });
  });
  it('AccessDenied is a distinct error', () => {
    expect(new AccessDenied().name).toBe('AccessDenied');
  });
});

describe('R10: no production bypass', () => {
  afterEach(() => vi.unstubAllEnvs());
  const real = async () => (await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session'));
  it('the demo owner exists only in development mock mode', async () => {
    const { demoActor } = await real();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BRIDGE_MODE', 'mock');
    expect(demoActor()).toMatchObject({ role: 'owner', demo: true });
    vi.stubEnv('NODE_ENV', 'production');
    expect(demoActor()).toBeNull();
    vi.stubEnv('NODE_ENV', 'test');
    expect(demoActor()).toBeNull();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BRIDGE_MODE', 'live');
    expect(demoActor()).toBeNull();
  });
  it('production without a Bridge URL is not demo mode and reports missing settings', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BRIDGE_MODE', '');
    vi.stubEnv('BRIDGE_URL', '');
    for (const k of ['BRIDGE_SECRET', 'TV_KEY', 'AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET', 'ALLOWED_DOMAIN', 'OWNER_EMAILS']) vi.stubEnv(k, '');
    const missing = missingEnv();
    expect(missing).toContain('BRIDGE_URL');
    expect(missing).toContain('AUTH_SECRET');
    expect(missing).toContain('TV_KEY');
  });
  it('production mock mode still requires the sign-in settings', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BRIDGE_MODE', 'mock');
    vi.stubEnv('AUTH_SECRET', '');
    expect(missingEnv()).toContain('AUTH_SECRET');
  });
  it('development demo mode needs nothing', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BRIDGE_MODE', '');
    vi.stubEnv('BRIDGE_URL', '');
    expect(missingEnv()).toEqual([]);
  });
});

beforeEach(() => vi.clearAllMocks());
