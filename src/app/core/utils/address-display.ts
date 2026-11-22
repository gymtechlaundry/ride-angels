/** Address display helpers — nickname lives in `label` when set; street/full text in `line1`. */

export function normalizeAddressPart(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** True when label is a nickname distinct from the street/full address. */
export function addressHasNickname(label: string, line1: string): boolean {
  const nick = normalizeAddressPart(label);
  const street = normalizeAddressPart(line1);
  return !!nick && !!street && nick !== street;
}

/** Card / compact title: prefer nickname, else a shortened address. */
export function addressCardLabel(label: string, line1?: string): string {
  const nick = normalizeAddressPart(label);
  const street = normalizeAddressPart(line1);
  if (addressHasNickname(nick, street)) {
    return nick;
  }
  const source = nick || street;
  return source.split('(')[0].trim() || source;
}

/** Street / formatted address for angels (maps, detail). */
export function addressStreetLine(label: string, line1?: string): string {
  const nick = normalizeAddressPart(label);
  const street = normalizeAddressPart(line1);
  if (street) return street;
  return nick;
}

export function packAddressFields(
  address: string,
  nickname?: string,
): { label: string; line1: string } {
  const street = normalizeAddressPart(address);
  const nick = normalizeAddressPart(nickname);
  if (!street && !nick) {
    return { label: '', line1: '' };
  }
  if (nick && street && nick !== street) {
    return { label: nick, line1: street };
  }
  const value = street || nick;
  return { label: value, line1: value };
}

export function unpackAddressFields(
  label: string,
  line1: string,
): { address: string; nickname: string } {
  const nick = normalizeAddressPart(label);
  const street = normalizeAddressPart(line1);
  if (addressHasNickname(nick, street)) {
    return { address: street, nickname: nick };
  }
  return { address: street || nick, nickname: '' };
}
