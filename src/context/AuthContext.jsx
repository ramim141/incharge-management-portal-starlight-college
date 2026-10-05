import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { backend } from '../backend';

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

  useEffect(() => {
    backend
      .getDoc(['meta', 'owner'])
      .then((o) => setNeedsSetup(!o))
      .catch(() => setNeedsSetup(false));
  }, [user]);

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
      signIn: backend.signIn,
      signOut: backend.signOut,
      resetPassword: backend.resetPassword,

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
