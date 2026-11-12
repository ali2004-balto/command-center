// Roles and what each may do. `field_staff` exists only to state that it can do nothing; nothing can obtain it.
export type Role = 'owner' | 'tv' | 'field_staff';
export type Capability = 'view_tv' | 'view_home' | 'view_team' | 'view_approvals' | 'change_switches' | 'approve_views' | 'decide_drafts' | 'dismiss_items';

export const ALL_CAPABILITIES: Capability[] = ['view_tv', 'view_home', 'view_team', 'view_approvals', 'change_switches', 'approve_views', 'decide_drafts', 'dismiss_items'];

export const CAPABILITIES: Record<Role, Capability[]> = {
  owner: ALL_CAPABILITIES,
  tv: ['view_tv'],
  field_staff: [],
};

export function can(role: Role | null | undefined, cap: Capability): boolean {
  return !!role && CAPABILITIES[role].includes(cap);
}
