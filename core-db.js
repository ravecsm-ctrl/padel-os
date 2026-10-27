// IndexedDB repository. Stores: sessions (keyPath id, indexed by startedAt) and
// meta (key/value). Falls back to memory, loudly, if IndexedDB is unavailable.
const NAME = 'padel-os-pro';
const VERSION = 1;
let dbp = null;
const mem = { sessions: new Map(), meta: new Map() };
export let persistent = true;

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = tx => new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export function open() {
  if (dbp) return dbp;
  if (!globalThis.indexedDB) { persistent = false; return (dbp = Promise.resolve(null)); }
  dbp = new Promise((res) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = (e) => {
      const d = r.result;
      // Migrations run in order; add `if (e.oldVersion < 2) {...}` blocks for future versions.
      if (e.oldVersion < 1) {
        const s = d.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('startedAt', 'startedAt');
        s.createIndex('kind', 'kind');
        d.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); res(r.result); };
    r.onerror = () => { persistent = false; res(null); };
    r.onblocked = () => { persistent = false; res(null); };
  });
  return dbp;
}

async function store(name, mode = 'readonly') {
  const d = await open();
  if (!d) return null;
  const tx = d.transaction(name, mode);
  return { s: tx.objectStore(name), tx };
}

export async function getMeta(key, fallback) {
  const t = await store('meta');
  if (!t) return mem.meta.has(key) ? mem.meta.get(key) : fallback;
  const row = await req(t.s.get(key));
  return row ? row.value : fallback;
}
export async function setMeta(key, value) {
  const t = await store('meta', 'readwrite');
  if (!t) { mem.meta.set(key, value); return value; }
  t.s.put({ key, value }); await done(t.tx); return value;
}
export async function delMeta(key) {
  const t = await store('meta', 'readwrite');
  if (!t) { mem.meta.delete(key); return; }
  t.s.delete(key); await done(t.tx);
}
export async function allMeta() {
  const t = await store('meta');
  if (!t) return Object.fromEntries(mem.meta);
  return Object.fromEntries((await req(t.s.getAll())).map(r => [r.key, r.value]));
}

export async function allSessions() {
  const t = await store('sessions');
  const rows = t ? await req(t.s.getAll()) : [...mem.sessions.values()];
  return rows.sort((a, b) => b.startedAt - a.startedAt);
}
export async function putSessions(list) {
  const t = await store('sessions', 'readwrite');
  if (!t) { list.forEach(s => mem.sessions.set(s.id, s)); return; }
  list.forEach(s => t.s.put(s)); await done(t.tx);
}
export const putSession = s => putSessions([s]);
export async function deleteSession(id) {
  const t = await store('sessions', 'readwrite');
  if (!t) { mem.sessions.delete(id); return; }
  t.s.delete(id); await done(t.tx);
}
export async function clearAll() {
  const d = await open();
  if (!d) { mem.sessions.clear(); mem.meta.clear(); return; }
  const tx = d.transaction(['sessions', 'meta'], 'readwrite');
  tx.objectStore('sessions').clear(); tx.objectStore('meta').clear();
  await done(tx);
}

// Ask the browser not to evict our data under storage pressure (important on iOS).
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch { return 'unsupported'; }
}
export async function persistenceStatus() {
  try { return navigator.storage?.persisted ? ((await navigator.storage.persisted()) ? 'granted' : 'not granted') : 'unsupported'; } catch { return 'unsupported'; }
}
