export function normalizePosCode(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.replace(/\D/g, '');
}

export function getPosCodeFromMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const candidate = (metadata as Record<string, unknown>).pos_code;
  return normalizePosCode(candidate);
}

/**
 * Generate a unique POS code.
 * Prefers 3-digit codes (000-999). When exhausted, expands to 4+ digits.
 */
export function generateNextPosCode(existingCodes: Set<string>): string {
  let length = 3;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const start = length === 3 ? 0 : 10 ** (length - 1);
    const end = (10 ** length) - 1;
    for (let n = start; n <= end; n += 1) {
      const code = String(n).padStart(length, '0');
      if (!existingCodes.has(code)) return code;
    }
    length += 1;
  }
}
