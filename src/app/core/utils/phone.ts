/** Normalize US-friendly input to E.164. Defaults to +1 when 10 digits. */
export function toE164(
  raw: string,
  defaultCallingCode = '+1',
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Enter a phone number.');
  }

  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (!/^\+\d{8,15}$/.test(digits)) {
      throw new Error('Enter a valid phone number with country code.');
    }
    return digits;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${defaultCallingCode}${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  throw new Error('Enter a 10-digit US number or include a country code.');
}

export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return e164;
}

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  return email;
}
