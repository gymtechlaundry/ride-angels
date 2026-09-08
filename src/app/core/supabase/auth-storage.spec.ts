import { createCapacitorAuthStorage } from './auth-storage';

function memoryBackend() {
  const data = new Map<string, string>();
  return {
    store: data,
    get: async ({ key }: { key: string }) => ({
      value: data.has(key) ? data.get(key)! : null,
    }),
    set: async ({ key, value }: { key: string; value: string }) => {
      data.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      data.delete(key);
    },
  };
}

describe('capacitorAuthStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a Preferences value when present', async () => {
    const backend = memoryBackend();
    await backend.set({ key: 'sb-auth', value: 'session-json' });
    const storage = createCapacitorAuthStorage(backend);
    await expectAsync(storage.getItem('sb-auth')).toBeResolvedTo('session-json');
  });

  it('migrates a leftover localStorage session into Preferences', async () => {
    const backend = memoryBackend();
    localStorage.setItem('sb-auth', 'legacy-session');
    const storage = createCapacitorAuthStorage(backend);
    await expectAsync(storage.getItem('sb-auth')).toBeResolvedTo(
      'legacy-session',
    );
    expect(backend.store.get('sb-auth')).toBe('legacy-session');
  });

  it('writes through to Preferences', async () => {
    const backend = memoryBackend();
    const storage = createCapacitorAuthStorage(backend);
    await storage.setItem('sb-auth', 'next');
    expect(backend.store.get('sb-auth')).toBe('next');
    await expectAsync(storage.getItem('sb-auth')).toBeResolvedTo('next');
  });

  it('clears Preferences and localStorage on remove', async () => {
    const backend = memoryBackend();
    await backend.set({ key: 'sb-auth', value: 'session-json' });
    localStorage.setItem('sb-auth', 'legacy-session');
    const storage = createCapacitorAuthStorage(backend);
    await storage.removeItem('sb-auth');
    expect(backend.store.has('sb-auth')).toBeFalse();
    expect(localStorage.getItem('sb-auth')).toBeNull();
  });
});
