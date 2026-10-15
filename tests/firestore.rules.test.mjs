import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
let env;
const valid = (revision) => ({
  schema: 1,
  state: { version: 1, items: [], stores: ["heb", "walmart"], preferences: {} },
  revision,
  updatedAt: serverTimestamp(),
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-store-scout",
    firestore: {
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
});
after(async () => {
  await env?.cleanup();
});
test("verified owner can create and read their own list", async () => {
  const db = env
    .authenticatedContext("alice", { email_verified: true })
    .firestore();
  await assertSucceeds(setDoc(doc(db, "users/alice/lists/main"), valid(1)));
  await assertSucceeds(getDoc(doc(db, "users/alice/lists/main")));
});
test("other accounts, unverified users, and signed-out visitors cannot access a private list", async () => {
  for (const context of [
    env.authenticatedContext("bob", { email_verified: true }),
    env.authenticatedContext("alice", { email_verified: false }),
    env.unauthenticatedContext(),
  ]) {
    const ref = doc(context.firestore(), "users/alice/lists/main");
    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, valid(2)));
  }
});
test("owner updates require the next revision, server timestamp, and allowed fields", async () => {
  const ref = doc(
    env.authenticatedContext("alice", { email_verified: true }).firestore(),
    "users/alice/lists/main",
  );
  await assertSucceeds(setDoc(ref, valid(2)));
  await assertFails(setDoc(ref, valid(2)));
  await assertFails(setDoc(ref, { ...valid(3), password: "not allowed" }));
  await assertFails(setDoc(ref, { ...valid(3), updatedAt: new Date(0) }));
  await assertFails(deleteDoc(ref));
});
test("new lists cannot skip revisions or write at unapproved paths", async () => {
  const db = env
    .authenticatedContext("carol", { email_verified: true })
    .firestore();
  await assertFails(setDoc(doc(db, "users/carol/lists/main"), valid(2)));
  await assertFails(setDoc(doc(db, "users/carol/lists/other"), valid(1)));
  await assertFails(setDoc(doc(db, "public/leak"), valid(1)));
});
test("profiles accept allowed themes but reject unexpected fields and invalid values", async () => {
  const ref = doc(
    env
      .authenticatedContext("profile-owner", { email_verified: true })
      .firestore(),
    "users/profile-owner/lists/main",
  );
  const profile = { name: "Sam", zip: "77019", mode: "dark", accent: "pink" };
  const payload = { ...valid(1), state: { ...valid(1).state, profile } };
  await assertSucceeds(setDoc(ref, payload));
  for (const bad of [
    { ...profile, password: "no" },
    { ...profile, accent: "red" },
    { ...profile, zip: "x" },
    { ...profile, name: "a".repeat(61) },
  ])
    await assertFails(
      setDoc(ref, { ...valid(2), state: { ...payload.state, profile: bad } }),
    );
  await assertFails(
    getDoc(
      doc(
        env
          .authenticatedContext("outsider", { email_verified: true })
          .firestore(),
        "users/profile-owner/lists/main",
      ),
    ),
  );
});
test("import receipts allow safe replay IDs but reject oversized or nested data", async () => {
  const ref = doc(
    env
      .authenticatedContext("import-owner", { email_verified: true })
      .firestore(),
    "users/import-owner/lists/main",
  );
  const payload = {
    ...valid(1),
    state: { ...valid(1).state, importReceipts: ["snapshot-1"] },
  };
  await assertSucceeds(setDoc(ref, payload));
  for (const receipts of [
    Array(21).fill("one"),
    ["one", "one"],
    [{ password: "bad" }],
    ["x".repeat(81)],
    ["bad/url"],
  ])
    await assertFails(
      setDoc(ref, {
        ...valid(2),
        state: { ...payload.state, importReceipts: receipts },
      }),
    );
});

test('verified owner can save Kroger selection but unknown retailers are rejected', async () => {
 const db=env.authenticatedContext('kroger-owner',{email_verified:true}).firestore();
 const ref=doc(db,'users/kroger-owner/lists/main');
 const data=valid(1);data.state.stores=['kroger'];
 await assertSucceeds(setDoc(ref,data));
 const bad=valid(2);bad.state.stores=['untrusted-retailer'];
 await assertFails(setDoc(ref,bad));
});

test('verified owner can enable all four stores but not more or unknown ones', async () => {
 const db=env.authenticatedContext('four-stores',{email_verified:true}).firestore();
 const ref=doc(db,'users/four-stores/lists/main');
 const data=valid(1);data.state.stores=['kroger','sellers','heb','walmart'];
 data.state.locations={sellers:{id:'sb-8011-elvera',name:'Sellers Bros. - 8011 Elvera',address:'8011 Elvera, Houston, TX 77012'}};
 await assertSucceeds(setDoc(ref,data));
 const bad=valid(2);bad.state.stores=['kroger','sellers','heb','walmart','kroger'];
 await assertFails(setDoc(ref,bad));
 const unknown=valid(2);unknown.state.stores=['target'];
 await assertFails(setDoc(ref,unknown));
});

test('owner can save a chosen store location but not malformed or unknown ones', async () => {
 const db=env.authenticatedContext('loc-owner',{email_verified:true}).firestore();
 const ref=doc(db,'users/loc-owner/lists/main');
 const data=valid(1);data.state.locations={kroger:{id:'03400355',name:'Kroger - River Oaks',address:'1938 W Gray St, Houston, TX'}};
 await assertSucceeds(setDoc(ref,data));
 const badId=valid(2);badId.state.locations={kroger:{id:'<script>',name:'x',address:''}};
 await assertFails(setDoc(ref,badId));
 const unknown=valid(2);unknown.state.locations={target:{id:'1',name:'x',address:''}};
 await assertFails(setDoc(ref,unknown));
 const extra=valid(2);extra.state.locations={kroger:{id:'1',name:'x',address:'',phone:'1'}};
 await assertFails(setDoc(ref,extra));
});
