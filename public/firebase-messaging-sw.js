/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging — background push handler.
 *
 * Registered by AppShell at scope "/firebase-cloud-messaging-push-scope"
 * so it doesn't clash with next-pwa's /sw.js at scope "/".
 *
 * Replace the placeholder config values below with your actual Firebase
 * project config (same values used in NEXT_PUBLIC_FIREBASE_* env vars).
 */

importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            self.FIREBASE_API_KEY            || "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain:        self.FIREBASE_AUTH_DOMAIN        || "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId:         self.FIREBASE_PROJECT_ID         || "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket:     self.FIREBASE_STORAGE_BUCKET     || "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId:             self.FIREBASE_APP_ID             || "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// Background message handler — fires when the app tab is hidden or closed.
// The `notification` payload is shown automatically by FCM; this handler
// lets you customise the notification or handle data-only messages.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  const url = payload.data?.url ?? "/";

  if (!title) return; // FCM will show the notification automatically if title exists

  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url },
  });
});

// Open / focus the app at the deep-link URL when the user taps the notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If a window is already open, focus it and navigate
        for (const client of windowClients) {
          if ("focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
