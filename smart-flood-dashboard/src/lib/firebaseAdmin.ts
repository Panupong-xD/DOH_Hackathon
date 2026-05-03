import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function initAdmin(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // Only use cert() if we have valid-looking credentials
  if (
    projectId &&
    clientEmail &&
    privateKey &&
    !privateKey.includes('YOUR_PRIVATE_KEY_HERE') &&
    privateKey.includes('BEGIN PRIVATE KEY')
  ) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  // Fallback: initialize with just projectId (limited functionality)
  console.warn(
    '[Firebase Admin] Service account credentials not configured or invalid.',
    'Server-side admin verification will be unavailable.',
    'Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local'
  );
  return initializeApp({
    projectId: projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'placeholder',
  });
}

const app = initAdmin();

export let adminAuth: Auth;
export let adminDb: Firestore;

try {
  adminAuth = getAuth(app);
  adminDb = getFirestore(app);
} catch (error) {
  console.error('[Firebase Admin] Failed to initialize services:', error);
  // Create dummy objects that will throw clear errors when used
  adminAuth = {} as Auth;
  adminDb = {} as Firestore;
}
