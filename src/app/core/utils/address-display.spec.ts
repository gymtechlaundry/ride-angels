import {
  addressCardLabel,
  addressHasNickname,
  addressStreetLine,
  packAddressFields,
  unpackAddressFields,
} from './address-display';

describe('address-display', () => {
  it('packs nickname + street into label/line1', () => {
    expect(packAddressFields('123 Main St', 'Home')).toEqual({
      label: 'Home',
      line1: '123 Main St',
    });
  });

  it('packs address-only without inventing a nickname', () => {
    expect(packAddressFields('123 Main St', '')).toEqual({
      label: '123 Main St',
      line1: '123 Main St',
    });
  });

  it('unpacks nicknamed addresses for the schedule form', () => {
    expect(unpackAddressFields('Home', '123 Main St')).toEqual({
      address: '123 Main St',
      nickname: 'Home',
    });
    expect(unpackAddressFields('123 Main St', '123 Main St')).toEqual({
      address: '123 Main St',
      nickname: '',
    });
  });

  it('prefers nickname on cards and keeps street for detail', () => {
    expect(addressHasNickname('Home', '123 Main St')).toBe(true);
    expect(addressCardLabel('Home', '123 Main St')).toBe('Home');
    expect(addressStreetLine('Home', '123 Main St')).toBe('123 Main St');
  });
});
