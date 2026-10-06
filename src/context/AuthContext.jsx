import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { backend } from '../backend';
import { loginIdPath, isStaffEmail } from '../lib/staffLogin';

const authError = (code) => Object.assign(new Error(code), { code });

/** "T001" → the account's email via loginIds; anything with "@" is already an email */
async function resolveLogin(identifier) {
  const raw = String(identifier || '').trim();
  if (raw.includes('@')) return { email: raw.toLowerCase(), entry: null };
  const entry = await backend.getDoc(loginIdPath(raw));
  if (!entry?.email) throw authError('auth/unknown-id');
  return { email: entry.email, entry };
}

// Who is signed in, their profile (role + class) and institution info.
const AuthContext = createContext(null);

const SELF_EDITABLE = ['name', 'phone', 'designation'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(undefined);
  const [institution, setInstitution] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => backend.onAuth(setUser), []);

  useEffect(() => {
    if (user === undefined) return undefined;
    if (!user) {
      setProfile(null);
      return undefined;
    }
    setProfile(undefined);
    return backend.subscribeDoc(['users', user.uid], (p) =>
      setProfile(p ? { ...p, uid: user.uid, email: p.email || user.email } : { uid: user.uid, email: user.email, role: null }),
    );
  }, [user]);

  useEffect(() => backend.subscribeDoc(['meta', 'institution'], setInstitution), []);

  // After a teacher confirms a new (recovery) email, the login itself moves to it — keep the
  // ID → email lookup and the profile pointing at whatever address Firebase now uses
  useEffect(() => {
    if (!user?.email || !profile?.loginId || profile.uid !== user.uid) return;
    const now = user.email.toLowerCase();
    if (String(profile.email || '').toLowerCase() === now && !profile.pendingEmail) return;
    if (profile.pendingEmail && profile.pendingEmail !== now && profile.email === now) return; // link not clicked yet
    backend.write([
      { type: 'merge', path: ['users', user.uid], data: { email: now, pendingEmail: null } },
      { type: 'merge', path: loginIdPath(profile.loginId), data: { email: now, pendingEmail: null } },
    ]);
  }, [user, profile]);

  // Live listener rather than a one-off read: a read made before the connection is up fails and
  // would hide first-run setup; the listener retries and answers once the server responds
  useEffect(
    () =>
      backend.subscribeDoc(['meta', 'owner'], (o) => {
        if (o !== undefined) setNeedsSetup(!o);
      }),
    [],
  );

  const value = useMemo(() => {
    // Until the profile for *this* user arrives (it lags one render behind sign-in), keep loading
    const profileReady = user && profile && profile.uid === user.uid;
    const status = user === undefined || (user && !profileReady) ? 'loading' : user ? 'signedIn' : 'signedOut';
    return {
      status,
      user,
      profile,
      institution,
      needsSetup,
      signOut: backend.signOut,

      /** Teachers type their login ID (T001), the principal their email */
      async signIn(identifier, password) {
        const { email, entry } = await resolveLogin(identifier);
        try {
          await backend.signIn(email, password);
        } catch (e) {
          // Recovery email confirmed but the lookup wasn't updated yet → try the new address
          if (!entry?.pendingEmail) throw e;
          await backend.signIn(entry.pendingEmail, password);
        }
      },

      async resetPassword(identifier) {
        const { email, entry } = await resolveLogin(identifier);
        const target = entry?.pendingEmail && isStaffEmail(email) ? entry.pendingEmail : email;
        if (isStaffEmail(target)) throw authError('auth/no-recovery-email');
        await backend.resetPassword(target);
        return target;
      },

      /** Own password; also clears the "change on first login" flag */
      async changePassword(current, next) {
        await backend.changePassword(current, next);
        await backend.write([{ type: 'merge', path: ['users', profile.uid], data: { mustChangePassword: false } }]);
      },

      /** Links a real email for password resets (Firebase sends a confirmation link there) */
      async addRecoveryEmail(current, newEmail) {
        const em = newEmail.trim().toLowerCase();
        await backend.requestEmailChange(current, em);
        const ops = [{ type: 'merge', path: ['users', profile.uid], data: { pendingEmail: em } }];
        if (profile.loginId) ops.push({ type: 'merge', path: loginIdPath(profile.loginId), data: { pendingEmail: em } });
        await backend.write(ops);
      },

      /** First run on a fresh Firebase project: create the principal account */
      async bootstrap({ institutionName, name, email, password, phone }) {
        const uid = await backend.createAccount(email, password);
        await backend.write(
          [
            { type: 'set', path: ['meta', 'owner'], data: { uid } },
            { type: 'set', path: ['users', uid], data: { role: 'superadmin', name, email: email.trim(), phone: phone || '', designation: 'অধ্যক্ষ', classId: null, active: true } },
            { type: 'set', path: ['meta', 'institution'], data: { name: institutionName, address: '' } },
          ],
          { wait: true },
        );
        setNeedsSetup(false);
      },

      updateMyProfile(patch) {
        const data = Object.fromEntries(Object.entries(patch).filter(([k]) => SELF_EDITABLE.includes(k)));
        return backend.write([{ type: 'merge', path: ['users', profile.uid], data }]);
      },
    };
  }, [user, profile, institution, needsSetup]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
