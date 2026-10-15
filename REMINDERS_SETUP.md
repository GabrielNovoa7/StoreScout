# Apple Shortcuts setup

Store Scout uses Apple Shortcuts as an upload-only Reminders client. The
Shortcut never receives a Firebase password or ID token, and it cannot read
an account list. It uploads the incomplete titles from one selected Reminders
list to the Store Scout inbox. Store Scout then previews the upload and saves
only the rows the user confirms to the signed-in Firebase account.

This repository does not contain an iCloud Shortcut share link. A share link
cannot be created or tested from this Windows checkout; do not publish a
placeholder link as if it were a working installation.

## Before creating the Shortcut

1. Deploy and test the Worker described in
   [`cloudflare/README.md`](cloudflare/README.md), without enabling billing.
2. Set the HTTPS Worker URL in `sync-config.js` and set `enabled: true`.
   Keep the URL free of credentials, query parameters, and fragments.
3. Open Store Scout in the same browser context used for the account, sign in
   with a verified email, open **Reminders import**, and choose **Create
   pairing code**.
4. Copy the displayed one-time code. It expires after ten minutes and can be
   claimed only once. Creating another pairing revokes the previous Shortcut
   and removes its pending upload.

## Pilot recipe status

The following is a one-run pairing/upload test, not the finished reusable Shortcut. It asks for a new code on every run because a Shortcut variable does not persist between runs. Do not expect this version to pair only once. After the first successful iPhone upload, separate setup from sync and keep the upload credential in a private file or private Shortcut configuration; verify repeat runs before sharing an unpaired template. Never share a credential-containing Shortcut or commit its credential.

In this pilot, select the specific shopping list directly in Find Reminders rather than relying on an unverified �Reminders Lists� action. Enter that same list name as text for the payload's listName.

## Shortcut action recipe

Create a personal Shortcut with these actions, in order:

1. **Ask for Input** — Text — prompt: `Store Scout pairing code`.
2. **Get Contents of URL**
   - URL: `https://storescout-reminders-inbox.xxnovoaxgx.workers.dev/pairings/claim`
   - Method: `POST`
   - Request body: `JSON`
   - JSON field `code`: the result of **Ask for Input**.
3. **Get Dictionary Value** — key `credential` from the previous response.
4. **Set Variable** — name `StoreScoutCredential` — value from
   **Get Dictionary Value**.
5. **Choose from List** — list: **Reminders Lists**. Save the result as
   `StoreScoutList`.
6. **Find Reminders**
   - List is your specific shopping list.
   - Is Completed is `false`.
   - Request only the reminder title/name field in the next action; do not
     upload notes, locations, due dates, or contact data.
7. **Repeat with Each** reminder:
   - **Get Details of Reminders** — detail `Name` from `Repeat Item`.
   - **Add to Variable** — variable `StoreScoutTitles` — the name.
8. **Get Contents of URL**
   - URL: `https://storescout-reminders-inbox.xxnovoaxgx.workers.dev/snapshots`
   - Method: `POST`
   - Headers: `Authorization: Bearer <StoreScoutCredential>`
   - Request body: `JSON`
   - `listName`: a Text value containing your chosen shopping list name.
   - `items`: `StoreScoutTitles`.
9. **Get Dictionary Value** � `snapshotId`. If missing, show an upload error and stop the Shortcut.
10. **Open URLs**
   - `https://gabrielnovoa7.github.io/StoreScout/#import`

The exact names of Reminders and Shortcuts actions can differ by iOS release.
Before using real groceries, run the Shortcut with one synthetic reminder and
confirm that the response contains a `snapshotId`. The Shortcut should not
complete, edit, or delete Reminders.

## Pairing and sync behavior

The pairing code is exchanged once for a random upload-only credential. The
Worker stores only hashes of codes and credentials. The credential can upload
the selected list's titles, but cannot read the inbox, acknowledge snapshots,
read Firebase, or write Firestore. The browser uses the signed-in user's
short-lived Firebase ID token for `/pairings`, `/connection`,
`/snapshots/latest`, and acknowledgement.

After the Shortcut opens Store Scout, choose **Check for uploaded list**. The
incoming titles are shown as a review. New normalized titles are selected by
default; existing and repeated titles are not. **Add N groceries** writes the
selected rows to `/users/{uid}/lists/main` through the existing
revision-checked Firebase transaction. A snapshot is acknowledged only after
that write succeeds. If acknowledgement fails, the bounded import receipt in
the Firebase list prevents a retry from creating duplicates.

Uploads and Firebase saves are deliberately separate outcomes. A successful
upload does not mean that a grocery has been added to the Store Scout list.
The physical iPhone flow still requires acceptance testing for Reminders
permissions, Safari/Home Screen sign-in context, offline behavior, failed
Firebase saves, repeated uploads, and disconnect/revocation.
