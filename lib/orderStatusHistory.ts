import type { SupabaseClient } from '@supabase/supabase-js';

export const ORDER_STATUS_CHANGES_KEY = 'status_changes' as const;

export type OrderStatusChangeEntry = {
  status: string;
  changed_at: string;
  changed_by_name: string;
  changed_by_email?: string | null;
  changed_by_id?: string | null;
};

/** Merge a new status-change row into order metadata (immutable append). */
export function appendOrderStatusChange(
  metadata: Record<string, unknown> | null | undefined,
  entry: OrderStatusChangeEntry
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...metadata }
      : {};
  const prev = Array.isArray(base[ORDER_STATUS_CHANGES_KEY])
    ? [...(base[ORDER_STATUS_CHANGES_KEY] as OrderStatusChangeEntry[])]
    : [];
  prev.push(entry);
  base[ORDER_STATUS_CHANGES_KEY] = prev;
  return base;
}

/** Resolve the signed-in admin/staff user for audit fields (client Supabase). */
export async function fetchCurrentStaffActor(
  supabase: SupabaseClient
): Promise<{ name: string; email: string | null; id: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { name: 'Unknown', email: null, id: null };
  }
  const uid = session.user.id;
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', uid)
    .maybeSingle();

  const metaName = session.user.user_metadata?.full_name;
  const name =
    (profile?.full_name && String(profile.full_name).trim()) ||
    (typeof metaName === 'string' && metaName.trim()) ||
    session.user.email?.split('@')[0] ||
    'Staff';

  const email = (profile?.email as string | undefined) || session.user.email || null;
  return { name, email, id: uid };
}
