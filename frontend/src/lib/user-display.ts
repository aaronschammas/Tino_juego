export function isPlaceholderLastname(lastname?: string | null) {
  if (!lastname) {
    return true;
  }

  const normalized = lastname.trim().toLowerCase();
  return normalized === '' || normalized === 'pending';
}

export function formatUserDisplayName(name?: string | null, lastname?: string | null) {
  const safeName = name?.trim() || '';
  const safeLastname = isPlaceholderLastname(lastname) ? '' : lastname!.trim();

  return [safeName, safeLastname].filter(Boolean).join(' ').trim();
}

export function getUserInitials(name?: string | null, lastname?: string | null) {
  const safeName = name?.trim() || '';
  const safeLastname = isPlaceholderLastname(lastname) ? '' : lastname?.trim() || '';

  const first = safeName[0] || '';
  const second = safeLastname[0] || '';

  return `${first}${second}`.toUpperCase() || '?';
}
