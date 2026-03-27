import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

/**
 * Returns the Firebase Admin Messaging instance.
 * Returns null if FIREBASE_PRIVATE_KEY is not set (FCM not configured).
 */
export function getAdminMessaging() {
  if (!process.env.FIREBASE_PRIVATE_KEY) return null;

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Vercel stores newlines as literal \n — expand them
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  return getMessaging();
}
