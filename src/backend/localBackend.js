import { buildDemoDocs } from './demoSeed';
import { newId } from '../lib/hash';

// Same interface as the Firebase backend, stored in this browser's localStorage.
// Used for the demo until Firebase is connected; everything stays on one device.
const DB_KEY = 'xi_demo_db_v2';
const SESSION_KEY = 'xi_demo_session';

const authError = (code) => Object.assign(new Error(code), { code });

export function createLocalBackend() {
  let state = load();
  const subs = new Set();
  const authListeners = new Set();
  const errorListeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      /* fall through to seed */
    }
    const seeded = buildDemoDocs();
    persist(seeded);
    return seeded;
  }

  function persist(s = state) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(s));
    } catch (e) {
      errorListeners.forEach((cb) => cb(Object.assign(e, { code: 'storage/quota' })));
    }
  }

  const keyOf = (path) => path.join('/');

  const readDoc = (key) => {
    const d = state.docs[key];
    return d ? { ...structuredClone(d), id: key.split('/').pop() } : null;
  };
  const readCollection = (key) => {
    const prefix = `${key}/`;
    const out = [];
    for (const k in state.docs) {
      if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) out.push({ ...structuredClone(state.docs[k]), id: k.slice(prefix.length) });
    }
    return out;
  };

  const addSub = (read, cb) => {
    const sub = {
      last: undefined,
      run() {
        const value = read();
        const json = JSON.stringify(value);
        if (json === sub.last) return;
        sub.last = json;
        cb(value);
      },
    };
    subs.add(sub);
    queueMicrotask(() => subs.has(sub) && sub.run());
    return () => subs.delete(sub);
  };

  const emit = () => subs.forEach((s) => s.run());

  // Another tab changed the data
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY && e.newValue) {
      state = JSON.parse(e.newValue);
      emit();
    }
    if (e.key === SESSION_KEY) notifyAuth();
  });

  const currentUser = () => {
    const uid = localStorage.getItem(SESSION_KEY);
    if (!uid) return null;
    const email = Object.keys(state.accounts).find((e) => state.accounts[e].uid === uid);
    return email ? { uid, email } : null;
  };
  const notifyAuth = () => {
    const u = currentUser();
    authListeners.forEach((cb) => cb(u));
  };

  return {
    mode: 'local',

    onError(cb) {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },

    onAuth(cb) {
      authListeners.add(cb);
      queueMicrotask(() => cb(currentUser()));
      return () => authListeners.delete(cb);
    },
    async signIn(email, password) {
      const acc = state.accounts[String(email).trim().toLowerCase()];
      if (!acc || acc.password !== password) throw authError('auth/invalid-credential');
      localStorage.setItem(SESSION_KEY, acc.uid);
      notifyAuth();
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY);
      notifyAuth();
    },
    async resetPassword() {
      throw authError('auth/demo-mode');
    },
    async createAccount(email, password, { secondary = false } = {}) {
      const key = String(email).trim().toLowerCase();
      if (state.accounts[key]) throw authError('auth/email-already-in-use');
      if (String(password).length < 6) throw authError('auth/weak-password');
      const uid = newId('u');
      state.accounts[key] = { uid, password };
      persist();
      if (!secondary) {
        localStorage.setItem(SESSION_KEY, uid);
        notifyAuth();
      }
      return uid;
    },
    /** Demo only: the principal can set a teacher's password directly. */
    async setPassword(email, password) {
      const key = String(email).trim().toLowerCase();
      if (!state.accounts[key]) throw authError('auth/user-not-found');
      state.accounts[key].password = password;
      persist();
    },

    subscribeDoc: (path, cb) => addSub(() => readDoc(keyOf(path)), cb),
    subscribeCollection: (path, cb) => addSub(() => readCollection(keyOf(path)), cb),
    getDoc: async (path) => readDoc(keyOf(path)),
    getCollection: async (path) => readCollection(keyOf(path)),

    async write(ops) {
      ops.forEach((op) => {
        const key = keyOf(op.path);
        if (op.type === 'delete') delete state.docs[key];
        else if (op.type === 'merge' || op.type === 'update') state.docs[key] = { ...(state.docs[key] || {}), ...structuredClone(op.data) };
        else state.docs[key] = structuredClone(op.data);
      });
      persist();
      emit();
    },

    async resetDemo() {
      localStorage.removeItem(DB_KEY);
      state = load();
      emit();
      notifyAuth();
    },
  };
}
