import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  setPersistence,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirebaseApp, isFirebaseSyncEnabled } from './firebase-app';

let authSingleton: Auth | null = null;
let uidPromise: Promise<string | null> | null = null;
let persistenceReady: Promise<void> | null = null;

function requireAuthClient(): Auth {
  const auth = getAuthClient();
  if (!auth) {
    throw new Error('auth/not-configured');
  }
  return auth;
}

function getClientAuth(): Auth | null {
  if (authSingleton) return authSingleton;
  const app = getFirebaseApp();
  if (!app) return null;
  authSingleton = getAuth(app);
  return authSingleton;
}

function ensurePersistence(auth: Auth): Promise<void> {
  if (persistenceReady) return persistenceReady;
  persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => {});
  return persistenceReady;
}

async function waitForInitialUser(auth: Auth, timeoutMs = 1200): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  await ensurePersistence(auth);
  if (auth.currentUser) return auth.currentUser;
  return await new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user ?? null);
    });
    window.setTimeout(() => {
      unsubscribe();
      resolve(auth.currentUser ?? null);
    }, timeoutMs);
  });
}

export function getAuthClient(): Auth | null {
  if (!isFirebaseSyncEnabled()) return null;
  return getClientAuth();
}

export function watchAuthState(callback: (user: User | null) => void): () => void {
  const auth = getAuthClient();
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    uidPromise = user?.uid ? Promise.resolve(user.uid) : null;
    callback(user);
  });
}

export async function ensureAnonymousUid(): Promise<string | null> {
  if (!isFirebaseSyncEnabled()) return null;
  if (uidPromise) {
    const cached = await uidPromise;
    if (cached) return cached;
    uidPromise = null;
  }

  const next = (async () => {
    const auth = getClientAuth();
    if (!auth) return null;
    const restored = await waitForInitialUser(auth);
    if (restored?.uid) return restored.uid;
    return null;
  })().catch(() => null);
  uidPromise = next;
  const uid = await next;
  if (!uid) {
    uidPromise = null;
  }
  return uid;
}

export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  const auth = requireAuthClient();
  await ensurePersistence(auth);
  const result = await signInWithEmailAndPassword(auth, email, password);
  uidPromise = result.user?.uid ? Promise.resolve(result.user.uid) : null;
  return result.user ?? null;
}

export async function signUpWithEmail(email: string, password: string): Promise<User | null> {
  const auth = requireAuthClient();
  await ensurePersistence(auth);
  const result = await createUserWithEmailAndPassword(auth, email, password);
  uidPromise = result.user?.uid ? Promise.resolve(result.user.uid) : null;
  return result.user ?? null;
}

export async function signInWithGoogle(): Promise<User | null> {
  const auth = requireAuthClient();
  await ensurePersistence(auth);
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    uidPromise = result.user?.uid ? Promise.resolve(result.user.uid) : null;
    return result.user ?? null;
  } catch (error) {
    const code = String((error as { code?: string })?.code || '');
    if (code.includes('popup') || code.includes('cancelled-popup-request')) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

export async function signOutCurrentUser(): Promise<void> {
  const auth = getAuthClient();
  if (!auth) return;
  await signOut(auth);
  uidPromise = null;
}

export async function consumeGoogleRedirectResult(): Promise<User | null> {
  const auth = getAuthClient();
  if (!auth) return null;
  await ensurePersistence(auth);
  const result = await getRedirectResult(auth);
  return result?.user ?? null;
}
