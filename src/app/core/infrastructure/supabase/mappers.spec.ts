import { mapDomainError } from './mappers';

describe('mapDomainError', () => {
  it('maps ride already assigned', () => {
    expect(mapDomainError('ride_already_assigned').message).toContain('claimed');
  });

  it('maps not trusted angel', () => {
    expect(mapDomainError('not_trusted_angel').message).toContain('trusted');
  });

  it('maps offer not pending', () => {
    expect(mapDomainError('offer_not_pending').message).toContain('no longer');
  });

  it('maps account deletion failures', () => {
    expect(mapDomainError('account_not_found').message).toContain('delete');
  });
});
