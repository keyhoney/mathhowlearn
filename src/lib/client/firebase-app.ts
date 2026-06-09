import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

function readConfig(): FirebaseClientConfig | null {
  const apiKey = import.meta.env.PUBLIC_FIREBASE_API_KEY?.trim() || '';
  const authDomain = import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '';
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID?.trim() || '';
  const appId = import.meta.env.PUBLIC_FIREBASE_APP_ID?.trim() || '';
  const storageBucket = import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || '';
  const messagingSenderId = import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || '';

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: storageBucket || undefined,
    messagingSenderId: messagingSenderId || undefined,
  };
}

let appSingleton: FirebaseApp | null = null;
let dbSingleton: Firestore | null = null;

export function isFirebaseSyncEnabled(): boolean {
  return readConfig() !== null;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (appSingleton) return appSingleton;
  const config = readConfig();
  if (!config) return null;
  appSingleton = getApps().length > 0 ? getApp() : initializeApp(config);
  return appSingleton;
}

export function getClientDb(): Firestore | null {
  if (dbSingleton) return dbSingleton;
  const app = getFirebaseApp();
  if (!app) return null;
  dbSingleton = getFirestore(app);
  return dbSingleton;
}
