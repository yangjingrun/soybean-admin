import localforage from 'localforage';
export function createStorage(type, storagePrefix) {
  const stg = type === 'session' ? window.sessionStorage : window.localStorage;
  const storage = {
    /**
     * Set session
     *
     * @param key Session key
     * @param value Session value
     */
    set(key, value) {
      const json = JSON.stringify(value);
      stg.setItem(`${storagePrefix}${key}`, json);
    },
    /**
     * Get session
     *
     * @param key Session key
     */
    get(key) {
      const json = stg.getItem(`${storagePrefix}${key}`);
      if (json) {
        let storageData = null;
        try {
          storageData = JSON.parse(json);
        } catch {}
        // storageData may be `false` if it is boolean type
        if (storageData !== null) {
          return storageData;
        }
      }
      stg.removeItem(`${storagePrefix}${key}`);
      return null;
    },
    remove(key) {
      stg.removeItem(`${storagePrefix}${key}`);
    },
    clear() {
      stg.clear();
    }
  };
  return storage;
}
export function createLocalforage(driver) {
  const driverMap = {
    local: localforage.LOCALSTORAGE,
    indexedDB: localforage.INDEXEDDB,
    webSQL: localforage.WEBSQL
  };
  localforage.config({
    driver: driverMap[driver]
  });
  return localforage;
}
