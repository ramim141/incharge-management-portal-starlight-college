import { initializeApp, deleteApp, getApps, getApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, createUserWithEmailAndPassword,
  sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword, verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, getDoc as fbGetDoc,
  getDocs, writeBatch,
} from 'firebase/firestore';

// Generic document store on top of Firebase. Paths are arrays like ['classes', 'XI-2026', 'students', 'std-1'].
export function createFirebaseBackend(config) {
  // Reuse the app if this module is evaluated again (dev hot-reload) — Firebase can only be set up once
  const fresh = !getApps().some((a) => a.name === '[DEFAULT]');
  const app = fresh ? initializeApp(config) : getApp();
  const auth = getAuth(app);
  // Offline-first: reads/writes work without network and sync when it returns
  const db = fresh
    ? initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    : getFirestore(app);

  const errorListeners = new Set();
  const reportError = (e) => {
    console.error(e);
    errorListeners.forEach((cb) => cb(e));
  };

  const ref = (path) => doc(db, ...path);

  /**
   * A Firestore listener stops for good after an error. "Permission denied" is often only momentary
   * (e.g. just after first-run setup, before the server has the new profile), so re-listen with
   * backoff and only report the error if it persists.
   */
  const listen = (start, cb, empty) => {
    let unsub = () => {};
    let timer = null;
    let tries = 0;
    let stopped = false;
    const run = () => {
      unsub = start(
        (value) => {
          tries = 0;
          cb(value);
        },
        (e) => {
          if (stopped) return;
          if (e?.code === 'permission-denied' && tries < 5) {
            tries += 1;
            timer = setTimeout(run, 800 * 2 ** (tries - 1));
            return;
          }
          reportError(e);
          cb(empty);
        },
      );
    };
    run();
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsub();
    };
  };

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

    /** Signed-in user changes their own password (re-checks the current one first) */
    async changePassword(current, next) {
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
      await updatePassword(u, next);
    },
    /** Moves the login to a real email; takes effect once the user clicks the link sent there */
    async requestEmailChange(current, newEmail) {
      const u = auth.currentUser;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
      await verifyBeforeUpdateEmail(u, newEmail.trim());
    },

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
      return listen((onNext, onError) => onSnapshot(ref(path), (snap) => onNext(snap.exists() ? { id: snap.id, ...snap.data() } : null), onError), cb, null);
    },
    subscribeCollection(path, cb) {
      return listen((onNext, onError) => onSnapshot(collection(db, ...path), (snap) => onNext(snap.docs.map((d) => ({ ...d.data(), id: d.id }))), onError), cb, []);
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
