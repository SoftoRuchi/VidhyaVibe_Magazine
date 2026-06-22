/** Normalize isAdmin from DB row (camelCase or snake_case column). */
export function rowIsAdmin(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  const v = row.isAdmin ?? row.is_admin;
  return v === true || v === 1 || v === '1';
}
