// The one function that decides who may sign in (rule 4.4). Anything else is refused.
export interface AuthConfig { allowedDomain: string; ownerEmails: string[] }
export interface GoogleProfile { email?: string | null; email_verified?: boolean | null; hd?: string | null }

export function authorizeGoogleProfile(profile: GoogleProfile | null | undefined, config: AuthConfig): boolean {
  if (!profile) return false;
  const domain = config.allowedDomain.trim().toLowerCase();
  if (!domain) return false;
  const email = (profile.email ?? '').trim().toLowerCase();
  if (profile.email_verified !== true) return false;
  if ((profile.hd ?? '').trim().toLowerCase() !== domain) return false;
  if (!email.endsWith('@' + domain)) return false;
  return config.ownerEmails.map((e) => e.trim().toLowerCase()).includes(email);
}

export function authConfigFromEnv(): AuthConfig {
  return {
    allowedDomain: process.env.ALLOWED_DOMAIN ?? '',
    ownerEmails: (process.env.OWNER_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  };
}
