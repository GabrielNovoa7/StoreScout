# Store Scout accounts and cloud lists

## Project

- Firebase project: `store-scout-9d930` (Store Scout)
- Web app: Store Scout Web
- Hosting stays on GitHub Pages; Firebase is used for Authentication and Firestore only.
- Plan: Spark / no-cost. Billing and paid backups are not enabled.
- Database: Standard edition, `(default)`, Dallas (`us-south1`).

## Required configuration

1. Enable Email/Password in Authentication. Leave anonymous and phone authentication disabled.
2. In Authentication Settings > Password policy, select **Require enforcement**, a minimum of **9**, a maximum of **128**, and require uppercase, lowercase, and numeric characters.
3. Authorize `gabrielnovoa7.github.io`, `localhost`, and `127.0.0.1` for the production site and local development.
4. Create Firestore in **production mode**. Publish the exact `firestore.rules` file before enabling the frontend.
5. Set public web config in `firebase-config.js`, then set `enabled: true`. Firebase web config identifies the project; it is not an admin secret. Never add service-account keys, admin credentials, passwords, or private keys to this repository.

## Behavior and privacy

- Visitors can continue using a guest workspace saved in this browser.
- Signup and password reset are handled by Firebase Authentication. The app does not save passwords, password hashes, or authentication tokens in localStorage/sessionStorage.
- Firebase Authentication uses memory-only persistence. Reloading the page requires signing in again. Signed-in lists survive in Firestore.
- Verify the account email before reading or writing its cloud list. The verification link opens Firebase's hosted email-action handler; return to Store Scout and click **I've verified my email**.
- Account grocery state is kept in memory, not cached persistently on a shared device. Signing out clears it and restores the separate guest workspace.
- Guest lists are only uploaded when the user clicks **Copy guest list into account**. Existing cloud items are kept and guest items are appended with new IDs. The local guest copy is not deleted.
- Autosave batches nearby edits after 800 ms. Status says when changes are pending, saving, saved, or failed. A failed save is not a successful sync.
- Reopen the account on another device to load its cloud copy. To pick up later changes while already signed in, use **Refresh cloud list**. There is no continuous paid/polling listener.
- A revision-checked Firestore transaction rejects stale writes from another device. Download unsaved work before choosing to reload the cloud copy. This increment does not automatically merge simultaneous edits.
- The browser warns before leaving with unsaved changes. Browsers cannot guarantee this warning on every mobile shutdown. Wait for the saved status before closing; a download is available in Account.
- One account has one private list in `/users/{uid}/lists/main`, capped at 200 items for the pilot. Sharing between different accounts is not included.
- Retailer pricing is still sample data. Account integration does not connect Apple Reminders or retailer feeds.

## Security checks

No dependency installation is needed to serve the site. Node and optional development dependencies are used only for testing:

```sh
npm ci
npm test
npm run test:rules
```

Rules tests use the local Firestore emulator, Java 21+, and a `demo-store-scout` project ID. They do not access production data. Port 8185 is used to avoid a busy default port. Emulator denial messages in successful negative tests are expected.

Tests verify account-load races, serialized writes, conflict preservation, password requirements, credential-free list serialization, non-destructive status updates, cleared notifications on account changes, and owner-only Firestore access. The deployed settings and real signup/email/login flow also need a manual smoke test.

## Manual acceptance check

1. Open Store Scout in your regular Edge/Chrome/Safari browser, create your own account, and verify your email. Enter your password directly into the app; do not send it to an AI assistant or put it in the repository.
2. Add a grocery and select a product. Wait for **Saved to your account**.
3. Sign into the same account on another device and verify the grocery and product appear.
4. Check off the item, wait for saving, and refresh the cloud list on the first device.
5. Sign out and verify the account list is hidden and the guest list is restored.
6. Confirm another account starts with a separate empty cloud list.

## Cost controls and limits

Keep the project on Spark and do not attach a billing account or enable a paid upgrade. Free usage has quotas; reaching a limit can interrupt service rather than guarantee unlimited access. Monitor Firebase's usage pages. Email sending also has quotas. Revisit abuse protection (including App Check), account recovery, monitoring, and a dedicated domain before broad public rollout.

## Public browser key and secret-scanning alerts

Firebase's browser API key in `firebase-config.js` is intentionally public. It identifies this Firebase project; it does not grant administrative access or bypass Authentication or Firestore rules. Moving it into a frontend environment variable would not make it secret in the delivered website.

On October 14, 2026, the browser key was restricted in Google Cloud Console to:

- Cloud Firestore API (`firestore.googleapis.com`)
- Identity Toolkit API (`identitytoolkit.googleapis.com`)
- Token Service API (`securetoken.googleapis.com`)

Website restrictions allow only `https://gabrielnovoa7.github.io/*`, `http://localhost:5500/*`, `http://127.0.0.1:5500/*`, `https://store-scout-9d930.firebaseapp.com/*`, and `https://store-scout-9d930.web.app/*`. The Firebase origins support hosted verification and password-reset pages. Update this allowlist when changing preview ports or adding a production domain. Website restrictions reduce misuse; they are not a replacement for database rules or abuse protection.

A scanner may still flag this public Google API key. After checking that the alert refers only to this browser config and the restrictions above remain in place, resolve this alert as **False positive** for this intentionally public Firebase client identifier. Explain that it is restricted to the three APIs above and protected by verified-owner Firestore rules. Never suppress all Google-key scanning. If an admin/service-account private key or a key granting access to other services is exposed, handle that separately and rotate/revoke it promptly.

Reference: https://firebase.google.com/support/guides/security-checklist#understand_api_keys
## References

- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/auth/web/auth-state-persistence
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## Profile schema

The optional `state.profile` map contains only `name` (trimmed display name, up to 60 characters), `zip` (five digits), `mode` (light/dark/system), and `accent` (green/blue/purple/orange/pink). Old lists without this map load with light/green defaults and ZIP 77019. Profile settings share the list's ownership and revision checks; no additional public collection is introduced. The updated rules were verified with the local Firestore emulator and published to the existing Firebase database.

Manual profile check: save a name and dark/blue settings, wait for saving, sign out, and verify light/green is restored. Sign into the same account in another browser/device and check the saved name/theme. Test pink as well. Unsaved profile drafts remain in memory; signing out or reloading the cloud copy requires confirmation before discarding them.
