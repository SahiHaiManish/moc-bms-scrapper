/** Offline tests for the lineup data.   npx tsx scripts/test-comics.ts */
import assert from "node:assert/strict";
import { emojiFor, instagramEmbedUrl, normalizeName, resolveLineup, safeUrl } from "../src/lib/comics";
import { DEFAULT_PUBLIC_MICS_BASE, buildRoster, comicsFeedUrl, fetchRoster, instagramLink, photoLink, recordsFromFeed, toComic, toPublicPhoto } from "../src/lib/comicsFeed";

let passed = 0;
const pending: Promise<void>[] = [];
const test = (name: string, fn: () => void | Promise<void>) => {
  const r = fn();
  const done = () => { passed++; console.log(`  ✓ ${name}`); };
  if (r instanceof Promise) pending.push(r.then(done)); else done();
};

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

test("photo links: localhost / any host is rewritten to the public mics address", () => {
  const pub = DEFAULT_PUBLIC_MICS_BASE;
  assert.equal(pub, "https://ministryofcomedy.in/mics");

  // the exact entry from a laptop run
  assert.equal(
    toPublicPhoto("http://localhost:4000/mics/comics/abhinav-anand.jpg?v=2026-10-17T09%3A02%3A16.554Z", pub),
    "https://ministryofcomedy.in/mics/comics/abhinav-anand.jpg?v=2026-10-17T09%3A02%3A16.554Z"
  );
  // mics app without the /mics prefix (its own .vercel.app address), and an already-public link
  assert.equal(toPublicPhoto("https://x.vercel.app/comics/a.jpg", pub), "https://ministryofcomedy.in/mics/comics/a.jpg");
  assert.equal(toPublicPhoto("https://ministryofcomedy.in/mics/comics/a.jpg", pub), "https://ministryofcomedy.in/mics/comics/a.jpg");
  // somebody else's CDN is left alone; no publicBase = no rewrite; trailing slash ok
  assert.equal(toPublicPhoto("https://cdn.example.com/pics/a.jpg", pub), "https://cdn.example.com/pics/a.jpg");
  assert.equal(toPublicPhoto("http://localhost:4000/mics/comics/a.jpg", undefined), "http://localhost:4000/mics/comics/a.jpg");
  assert.equal(toPublicPhoto("http://localhost:4000/comics/a.jpg", pub + "/"), "https://ministryofcomedy.in/mics/comics/a.jpg");

  // through the mapper, and never turns an unsafe value into a link
  const rec = { name: "Abhinav Anand", photo: "http://localhost:4000/mics/comics/abhinav-anand.jpg?v=1", reel: "https://www.instagram.com/reel/DMIOYL7PxUv/" };
  assert.deepEqual(toComic(rec, { publicBase: pub }), {
    name: "Abhinav Anand", photo: "https://ministryofcomedy.in/mics/comics/abhinav-anand.jpg?v=1", reel: "https://www.instagram.com/reel/DMIOYL7PxUv/",
  });
  assert.equal(photoLink("javascript:alert(1)", { publicBase: pub }), undefined);
});

test("fetchRoster: reads the feed live, maps it, and falls back to null on any failure", async () => {
  const feed = [
    { id: "abhinav-anand", name: "Abhinav Anand", photo: "http://localhost:4000/mics/comics/abhinav-anand.jpg?v=1", reel: "https://www.instagram.com/reel/X/" },
    { id: "n", name: "Nayab Sadaf" },
  ];
  const seen: string[] = [];
  const ok = (async (url: any) => { seen.push(String(url)); return new Response(JSON.stringify(feed), { status: 200 }); }) as typeof fetch;

  const roster = await fetchRoster({ MICS_LINEUPS_URL: "http://localhost:4000/lineups.json" }, ok);
  assert.deepEqual(seen, ["http://localhost:4000/comics.json"]);
  assert.equal(roster?.[0].photo, "https://ministryofcomedy.in/mics/comics/abhinav-anand.jpg?v=1");
  assert.equal(roster?.[1].photo, "https://ministryofcomedy.in/mics/comics/n.jpg"); // id fallback, also public
  assert.equal(roster?.[1].reel, undefined);

  const custom = await fetchRoster({ MICS_COMICS_URL: "http://h/c.json", MICS_PUBLIC_URL: "https://example.org/m" }, ok);
  assert.equal(custom?.[1].photo, "https://example.org/m/comics/n.jpg");

  const status = (code: number) => (async () => new Response("x", { status: code })) as typeof fetch;
  assert.equal(await fetchRoster({ MICS_LINEUPS_URL: "http://h" }, status(500)), null);
  assert.equal(await fetchRoster({ MICS_LINEUPS_URL: "http://h" }, (async () => { throw new Error("offline"); }) as typeof fetch), null);
  assert.equal(await fetchRoster({ MICS_LINEUPS_URL: "http://h" }, (async () => new Response("<html>", { status: 200 })) as typeof fetch), null);
  assert.equal(await fetchRoster({ MICS_LINEUPS_URL: "http://h" }, (async () => new Response("[]", { status: 200 })) as typeof fetch), null);
  assert.equal(await fetchRoster({}, ok), null); // not configured
});

test("instagram embed address: reels/posts embed, profiles and junk do not", () => {
  const E = (u?: string) => instagramEmbedUrl(u);
  assert.equal(E("https://www.instagram.com/reel/DMIOYL7PxUv/"), "https://www.instagram.com/reel/DMIOYL7PxUv/embed");
  assert.equal(E("https://www.instagram.com/reel/DMIOYL7PxUv/?igsh=abc&utm_source=qr"), "https://www.instagram.com/reel/DMIOYL7PxUv/embed");
  assert.equal(E("https://instagram.com/reel/AbC_-12"), "https://www.instagram.com/reel/AbC_-12/embed");
  assert.equal(E("http://www.instagram.com/reels/XyZ9/"), "https://www.instagram.com/reel/XyZ9/embed");
  assert.equal(E("https://www.instagram.com/someone/reel/QQQ1/"), "https://www.instagram.com/reel/QQQ1/embed");
  assert.equal(E("https://www.instagram.com/p/Cx12_a/"), "https://www.instagram.com/p/Cx12_a/embed");
  assert.equal(E("https://www.instagram.com/tv/Zz1/"), "https://www.instagram.com/tv/Zz1/embed");
  // not embeddable -> undefined (the button then opens Instagram instead)
  assert.equal(E("https://www.instagram.com/aman.jotwani/"), undefined);
  assert.equal(E("https://www.instagram.com/reel/"), undefined);
  assert.equal(E("https://evil.com/?u=https://www.instagram.com/reel/AAA/"), undefined);
  assert.equal(E("https://instagram.com.evil.com/reel/AAA/"), undefined);
  assert.equal(E("javascript:alert(1)"), undefined);
  assert.equal(E(undefined), undefined);
});

Promise.all(pending).then(() => console.log(`\n${passed} comics tests passed`)).catch((err) => { console.error(err); process.exit(1); });
