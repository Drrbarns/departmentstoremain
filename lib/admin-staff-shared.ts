/** Client-safe staff role helpers (no server imports). */

export const STAFF_ROLES = ['admin', 'staff', 'staff_pos'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const DEFAULT_STAFF_ROLE: StaffRole = 'staff';

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'staff_pos') return 'POS only';
  if (role === 'staff') return 'Staff';
  return role;
}
