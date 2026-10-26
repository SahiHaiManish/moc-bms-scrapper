/** Offline tests for the lineup data.   npx tsx scripts/test-comics.ts */
import assert from "node:assert/strict";
import { emojiFor, normalizeName, resolveLineup, safeUrl } from "../src/lib/comics";
import { buildRoster, comicsFeedUrl, decodeFirestoreDoc, instagramLink, photoLink, recordsFromFeed, toComic } from "./lib/comicsSource";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

test("Firestore REST documents are decoded", () => {
  const rec = decodeFirestoreDoc({
    name: "projects/p/databases/(default)/documents/comics/abc123",
    fields: {
      name: { stringValue: "Aman Jotwani" },
      reel: { stringValue: "https://www.instagram.com/reel/XYZ/" },
      followers: { integerValue: "1200" },
      tags: { arrayValue: { values: [{ stringValue: "a" }] } },
      meta: { mapValue: { fields: { ok: { booleanValue: true } } } },
    },
  });
  assert.deepEqual(rec, {
    _id: "abc123", name: "Aman Jotwani", reel: "https://www.instagram.com/reel/XYZ/",
    followers: 1200, tags: ["a"], meta: { ok: true },
  });
});

test("different field spellings map to name / photo / reel", () => {
  assert.deepEqual(toComic({ comicName: "A B", photoURL: "https://x/p.jpg", instagramReel: "https://instagram.com/reel/1" }),
    { name: "A B", photo: "https://x/p.jpg", reel: "https://instagram.com/reel/1" });
  assert.deepEqual(toComic({ NAME: "C D", Image: "https://x/q.jpg" }), { name: "C D", photo: "https://x/q.jpg", reel: undefined });
  assert.equal(toComic({ photo: "https://x" }), null); // no name
  assert.equal(toComic({ name: "   " }), null);
});

test("instagram: links kept, @handles expanded, junk dropped", () => {
  assert.equal(instagramLink("https://www.instagram.com/reel/abc/"), "https://www.instagram.com/reel/abc/");
  assert.equal(instagramLink("@aman.jotwani"), "https://www.instagram.com/aman.jotwani/");
  assert.equal(instagramLink("aman_j"), "https://www.instagram.com/aman_j/");
  assert.equal(instagramLink("javascript:alert(1)"), undefined);
  assert.equal(instagramLink("not a handle!"), undefined);
  assert.equal(instagramLink(undefined), undefined);
});

test("photos: links kept, storage paths need a bucket, unsafe schemes dropped", () => {
  assert.equal(photoLink("https://cdn/x.jpg", {}), "https://cdn/x.jpg");
  assert.equal(photoLink("comics/aman 1.jpg", {}), undefined);
  assert.equal(photoLink("comics/aman 1.jpg", { storageBucket: "b.appspot.com" }),
    "https://firebasestorage.googleapis.com/v0/b/b.appspot.com/o/comics%2Faman%201.jpg?alt=media");
  assert.equal(photoLink("javascript:alert(1)", { storageBucket: "b" }), undefined);
  assert.equal(photoLink("data:text/html,x", { storageBucket: "b" }), undefined);
});

test("roster: duplicates merged (fuller entry wins), nameless dropped, sorted A-Z, no undefined keys", () => {
  const r = buildRoster([
    { name: "Zed" }, { name: "aman jotwani", reel: "https://i/r" },
    { name: "Aman Jotwani", photo: "https://x/a.jpg" }, { photo: "https://nameless" },
  ]);
  assert.deepEqual(r, [{ name: "aman jotwani", reel: "https://i/r", photo: "https://x/a.jpg" }, { name: "Zed" }]);
  assert.ok(!("photo" in r[1]));
});

test("normalizeName ignores case, spacing, accents and punctuation", () => {
  assert.equal(normalizeName("  Nayab   sadaf "), normalizeName("Nayab Sadaf"));
  assert.equal(normalizeName("Akash V. Thabaj"), normalizeName("akash v thabaj"));
  assert.equal(normalizeName("Zoë"), normalizeName("Zoe"));
});

test("safeUrl accepts only http(s)", () => {
  assert.equal(safeUrl("https://a.b"), "https://a.b");
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl(42), undefined);
});

test("lineup from the real card: matched ones get photo + reel, unknown ones still listed", () => {
  const roster = [
    { name: "Aman Jotwani", photo: "https://x/aman.jpg", reel: "https://instagram.com/reel/1" },
    { name: "Nayab Sadaf", photo: "https://x/nayab.jpg" },
    { name: "Evil", photo: "javascript:alert(1)", reel: "javascript:alert(2)" },
  ];
  const lineup = resolveLineup(
    ["Aman Jotwani", "Ruchi Kumari", "Nayab sadaf", "aman jotwani", "Evil", " "], roster
  );
  assert.deepEqual(lineup, [
    { name: "Aman Jotwani", photo: "https://x/aman.jpg", reel: "https://instagram.com/reel/1", known: true },
    { name: "Ruchi Kumari", known: false },
    { name: "Nayab Sadaf", photo: "https://x/nayab.jpg", reel: undefined, known: true },
    { name: "Evil", photo: undefined, reel: undefined, known: true },
  ]);
});

test("empty roster / empty performers", () => {
  assert.deepEqual(resolveLineup([], [{ name: "A" }]), []);
  assert.deepEqual(resolveLineup(["A"], []), [{ name: "A", known: false }]);
});

test("feed address: explicit wins; derived from MICS_LINEUPS_URL in every shape", () => {
  assert.equal(comicsFeedUrl({ MICS_COMICS_URL: "https://a/c.json", MICS_LINEUPS_URL: "https://b" }), "https://a/c.json");
  assert.equal(comicsFeedUrl({ MICS_LINEUPS_URL: "https://x.vercel.app/lineups.json" }), "https://x.vercel.app/comics.json");
  assert.equal(comicsFeedUrl({ MICS_LINEUPS_URL: "https://x.vercel.app/" }), "https://x.vercel.app/comics.json");
  assert.equal(comicsFeedUrl({ MICS_LINEUPS_URL: "https://x.vercel.app/mics/lineups.json?v=1" }), "https://x.vercel.app/mics/comics.json");
  assert.equal(comicsFeedUrl({ MICS_LINEUPS_URL: "https://x.vercel.app/feeds/all.json" }), "https://x.vercel.app/feeds/comics.json");
  assert.equal(comicsFeedUrl({}), undefined);
});

test("feed: bare array or wrapped; relative photos resolved; id fallback; aliases kept", () => {
  assert.equal(recordsFromFeed({ comics: [{ name: "A" }, 5, null] }).length, 1);
  assert.equal(recordsFromFeed([{ name: "A" }]).length, 1);
  assert.deepEqual(recordsFromFeed("nope"), []);

  const opts = { baseUrl: "https://m.vercel.app/comics.json", photoBase: "https://m.vercel.app" };
  assert.equal(toComic({ name: "A", photo: "/comics/a1.jpg" }, opts)?.photo, "https://m.vercel.app/comics/a1.jpg");
  assert.equal(toComic({ name: "A", id: "a 1" }, opts)?.photo, "https://m.vercel.app/comics/a%201.jpg");
  assert.equal(toComic({ name: "A", photo: "javascript:alert(1)" }, opts)?.photo, undefined);
  assert.deepEqual(
    toComic({ name: "Aman Jotwani", aliases: ["Aman J", "aman jotwani", " "] , photo: "https://x/p.jpg" })?.aliases, ["Aman J"]);
  assert.deepEqual(toComic({ name: "B", otherSpellings: "Bee; Beee, B" })?.aliases, ["Bee", "Beee"]);
});

test("aliases and '(Comic)' resolve to the roster comic, but never steal another comic's own name", () => {
  const roster = [
    { name: "Aman Jotwani", aliases: ["Aman J", "Aman Mishra"], photo: "https://x/a.jpg" },
    { name: "Aman Mishra", reel: "https://instagram.com/reel/m" },
  ];
  const l = resolveLineup(["aman j", "Aman Mishra", "Aman Jotwani (Comic)"], roster);
  assert.equal(l[0].name, "Aman Jotwani");                 // via alias
  assert.equal(l[1].name, "Aman Mishra");                  // own name beats someone else's alias
  assert.equal(l[1].reel, "https://instagram.com/reel/m");
  assert.equal(l.length, 2);                               // "(Comic)" form is the same person as l[0]
  assert.equal(normalizeName("Raghav Batra (Comedian)"), "raghav batra");
});

test("stand-in emoji: stable per comic, spelling-proof, varied across comics", () => {
  assert.equal(emojiFor("Aman Jotwani"), emojiFor("Aman Jotwani"));
  assert.equal(emojiFor("Aman Jotwani"), emojiFor("  aman   JOTWANI (Comic) "));
  const names = ["Aman Jotwani", "Ruchi Kumari", "Nayab Sadaf", "Manish Jain", "Samarpan Bose", "Aman Mishra", "Raghav Batra", "Akash V Thabaj"];
  assert.ok(new Set(names.map(emojiFor)).size >= 5, "emoji should vary across a lineup");
  assert.ok(names.every((n) => emojiFor(n).length > 0));
  assert.equal(typeof emojiFor(""), "string");
});

test("no reel -> no reel in the lineup entry (so no button)", () => {
  const [a, b, c] = resolveLineup(["A", "B", "C"], [
    { name: "A", reel: "https://instagram.com/reel/1" }, { name: "B" }, { name: "C", reel: "javascript:alert(1)" },
  ]);
  assert.equal(a.reel, "https://instagram.com/reel/1");
  assert.equal(b.reel, undefined);
  assert.equal(c.reel, undefined);
});

console.log(`\n${passed} comics tests passed`);
