// SPDX-FileCopyrightText: © 2017 EteSync Authors
// SPDX-License-Identifier: AGPL-3.0-only

// Older versions of the app registered a service worker that served the app from a cache.
// The app doesn't come with one anymore, so remove any that is left over, as it would keep
// serving the old version.
export default function unregisterServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {
      // Nothing to clean up
    });
  }
}
