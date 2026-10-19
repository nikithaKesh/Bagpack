(() => {
  const projectUrl = 'https://scsfdktyemkosnhtwbqp.supabase.co';
  const publishableKey = 'sb_publishable_KRl-tvP0lNstq0Rw5n6Fqw_36dwwBaC';
  window.BAGPACK_CONFIG = Object.freeze({
    APP_PIN: '1102',
    SUPABASE: Object.freeze({ url: projectUrl, publishableKey }),
    STORAGE: Object.freeze({
      theme: 'bagpack-theme',
      appUnlocked: 'bagpack-app-unlocked',
      vaultLocalOnly: 'bagpack-vault-local-only',
      resetBackup: 'bagpack-reset-backup',
      lastCloudSync: 'bagpack-last-cloud-sync'
    }),
    PAGE_SIZE: 48
  });
  window.bagpackUid = (prefix='id') => {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${id}`;
  };
})();