import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, getDoc as fbGetDoc,
  getDocs, writeBatch,
} from 'firebase/firestore';

// Generic document store on top of Firebase. Paths are arrays like ['classes', 'XI-2026', 'students', 'std-1'].
export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  // Offline-first: reads/writes work without network and sync when it returns
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  const errorListeners = new Set();
  const reportError = (e) => {
    console.error(e);
    errorListeners.forEach((cb) => cb(e));
  };

  const ref = (path) => doc(db, ...path);

  return {
    mode: 'firebase',

    onError(cb) {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },

    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
    },
    async signIn(email, password) {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    signOut: () => fbSignOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),

    /** Creates a login. With `secondary`, the current user stays signed in (used by the principal). */
    async createAccount(email, password, { secondary = false } = {}) {
      if (!secondary) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        return cred.user.uid;
      }
      const tmp = initializeApp(config, `secondary-${Date.now()}`);
      try {
        const tmpAuth = getAuth(tmp);
        const cred = await createUserWithEmailAndPassword(tmpAuth, email.trim(), password);
        await fbSignOut(tmpAuth);
        return cred.user.uid;
      } finally {
        await deleteApp(tmp);
      }
    },

    subscribeDoc(path, cb) {
      return onSnapshot(
        ref(path),
        (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
        (e) => {
          reportError(e);
          cb(null);
        },
      );
    },
    subscribeCollection(path, cb) {
      return onSnapshot(
        collection(db, ...path),
        (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
        (e) => {
          reportError(e);
          cb([]);
        },
      );
    },
    async getDoc(path) {
      const snap = await fbGetDoc(ref(path));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    async getCollection(path) {
      const snap = await getDocs(collection(db, ...path));
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    },

    /**
     * Applies ops in batches. Returns immediately-ish: Firestore applies the change to the local
     * cache at once (so the UI updates offline) and syncs in the background.
     */
    write(ops, { wait = false } = {}) {
      const commits = [];
      for (let i = 0; i < ops.length; i += 450) {
        const batch = writeBatch(db);
        ops.slice(i, i + 450).forEach((op) => {
          const r = ref(op.path);
          if (op.type === 'delete') batch.delete(r);
          else if (op.type === 'update') batch.update(r, op.data);
          else batch.set(r, op.data, op.type === 'merge' ? { merge: true } : {});
        });
        commits.push(batch.commit());
      }
      const all = Promise.all(commits).catch((e) => {
        reportError(e);
        throw e;
      });
      if (wait) return all;
      all.catch(() => {});
      return Promise.resolve();
    },
  };
}
