/**
 * GET /tonight.png                   tonight's poster (India date)
 * GET /tonight.png?date=2026-10-17   another night, for previewing
 *
 * 1080x1350 (4:5). The idea: a page torn from a comic's notebook. A to-do
 * list where the boring chores are crossed out and "go see comedy" gets the
 * tick, and every show is a sticky note taped onto the page.
 * Built from public/shows.json, so it always matches the site.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getTonight, type TonightShow } from "@/lib/tonight";

import * as doodle from "./doodles";

const W = 1080;
const H = 1350;

const PAPER = "#FFFEF8";
const INK = "#1B1F3B"; // ballpoint navy, not pure black
const RED = "#E8433A"; // the marker that crosses things out

const NOTES = ["#FFE45C", "#FF9EC4", "#8EE3C8", "#C9B6FF", "#FFB067", "#9ED8FF"];
const TILT = [-2.5, 2, -1.6, 2.6, -2.1, 1.4];

const MAX_SHOWS = 6;
const LEFT = 140; // just right of the margin line
const RIGHT = 50;

/** Things we'd all rather skip. Two get crossed out each night. */
const CHORES = [
  "laundry",
  "gym",
  "reply to that email",
  "call mom back",
  "sleep early",
  "meal prep",
  "the dishes",
  "doomscrolling",
  "overthinking",
  "be productive",
  "taxes",
  "fix my life",
];

const asset = (name: string) => readFile(join(process.cwd(), "assets", "tonight", name));

/** Same chores all night, different ones tomorrow. */
function choresFor(date: string): [string, string] {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = h % CHORES.length;
  const b = (a + 1 + ((h >>> 8) % (CHORES.length - 1))) % CHORES.length;
  return [CHORES[a], CHORES[b]];
}

/** Shorter poster titles: the comics are listed separately anyway. */
function posterTitle(title: string): string {
  const t = title
    .replace(/\s+(feat\.?|ft\.?|featuring|by)\s+.*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  // "Ghutne 2.0 - Standup Comedy", "Toxic Pyaar: Relationship Comedy!" -> the name part
  const head = t.split(/\s+[-–|]\s+|:\s+/)[0].trim();
  return head.length >= 4 ? head : t;
}

/** Words with a wobbly red marker line through them. */
function Struck({ text, px }: { text: string; px: number }) {
  return (
    <div style={{ display: "flex", position: "relative", color: "#8A8DA6" }}>
      <div style={{ display: "flex" }}>{text}</div>
      <div
        style={{
          position: "absolute",
          left: -8,
          right: -8,
          top: Math.round(px * 0.55),
          height: Math.max(5, Math.round(px / 9)),
          background: RED,
          borderRadius: 6,
          transform: "rotate(-2.5deg)",
        }}
      />
    </div>
  );
}

function Ticked({ text, px }: { text: string; px: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", color: INK }}>
      <div style={{ display: "flex" }}>{text}</div>
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
      <img src={doodle.tick(RED)} width={Math.round(px * 1.1)} height={Math.round(px * 0.96)} alt="" style={{ marginLeft: 10, marginTop: -Math.round(px * 0.3) }} />
    </div>
  );
}

/** Type and photo sizes for the notes: bigger when there are fewer of them. */
function noteSizes(count: number, height: number) {
  if (count === 1) return { time: 84, title: 66, names: 46, pad: 50, maxNames: 5, photo: 250 };
  if (count === 2) return { time: 66, title: 52, names: 38, pad: 44, maxNames: 5, photo: 170 };
  if (height >= 330) return { time: 54, title: 44, names: 34, pad: 40, maxNames: 4, photo: 140 };
  if (height >= 260) return { time: 46, title: 38, names: 30, pad: 30, maxNames: 3, photo: 112 };
  return { time: 38, title: 32, names: 26, pad: 26, maxNames: 3, photo: 96 };
}

/** A Polaroid with a first name scribbled underneath. */
function Polaroid({ src, name, size, tilt }: { src: string; name: string; size: number; tilt: number }) {
  const frame = Math.round(size * 0.07);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#FFFFFF",
        paddingTop: frame,
        paddingLeft: frame,
        paddingRight: frame,
        paddingBottom: Math.round(frame * 0.6),
        transform: `rotate(${tilt}deg)`,
        boxShadow: "4px 6px 0 rgba(27,31,59,0.2)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
      <img src={src} width={size} height={size} alt="" style={{ objectFit: "cover" }} />
      <div style={{ display: "flex", fontFamily: "Hand", fontSize: Math.max(20, Math.round(size * 0.17)), color: INK, lineHeight: 1.15, marginTop: Math.round(frame * 0.6) }}>
        {name.split(" ")[0]}
      </div>
    </div>
  );
}

/** Fetches a photo as a data URI; null when it can't be loaded in time. */
async function photoData(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 1_000_000) return null;
    return `data:${type.split(";")[0]};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Note({
  show,
  index,
  count,
  width,
  height,
  photos,
}: {
  show: TonightShow;
  index: number;
  count: number;
  width: number;
  height: number;
  photos: { name: string; src: string }[];
}) {
  const z = noteSizes(count, height);
  const roomy = z.pad >= 40;
  const title = posterTitle(show.title);

  const timePx = z.time;
  const titlePx = Math.round(z.title * (title.length > 40 ? 0.68 : title.length > 22 ? 0.82 : 1));
  const namePx = z.names;

  const maxNames = z.maxNames;
  const names = show.performers;
  const shownNames =
    names.length === 0
      ? ["surprise acts", "(no spoilers)"]
      : names.length > maxNames
        ? [...names.slice(0, maxNames - 1), `+ ${names.length - maxNames + 1} more`]
        : names;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width,
        height,
        background: NOTES[index % NOTES.length],
        paddingTop: z.pad,
        paddingLeft: roomy ? 36 : 30,
        paddingRight: 26,
        paddingBottom: 18,
        transform: `rotate(${TILT[index % TILT.length]}deg)`,
        boxShadow: "8px 10px 0 rgba(27,31,59,0.13)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
      <img
        src={doodle.tape()}
        width={150}
        height={48}
        alt=""
        style={{ position: "absolute", top: -24, left: Math.round(width / 2 - 75), transform: `rotate(${index % 2 ? 4 : -5}deg)` }}
      />

      {photos.length > 0 && (
        // Polaroids stuck on the right edge of the note, poking out a little.
        <div
          style={{
            position: "absolute",
            top: z.pad + Math.round(z.time * 1.05), // below the time, so they never cover it
            right: -Math.round(z.photo * 0.12),
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          {photos.map((p, i) => (
            <div key={p.src.slice(-24) + i} style={{ display: "flex", marginTop: i ? -Math.round(z.photo * 0.08) : 0, marginRight: i ? Math.round(z.photo * 0.18) : 0 }}>
              <Polaroid src={p.src} name={p.name} size={z.photo} tilt={i % 2 ? -6 : 5} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", fontFamily: "Marker", fontSize: timePx, color: RED, lineHeight: 1 }}>
        {show.time.toLowerCase()}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          fontFamily: "Marker",
          fontSize: titlePx,
          color: INK,
          lineHeight: 1.08,
          marginTop: roomy ? 14 : 8,
          // keep text clear of the Polaroids
          paddingRight: photos.length ? Math.round(z.photo * 0.95) : 0,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Hand",
          fontSize: namePx,
          color: INK,
          lineHeight: 1.12,
          marginTop: roomy ? 14 : 8,
          paddingRight: photos.length ? Math.round(z.photo * 0.95) : 0,
        }}
      >
        <div style={{ display: "flex", fontSize: Math.round(namePx * 0.8), opacity: 0.7 }}>with</div>
        {shownNames.map((n) => (
          <div key={n} style={{ display: "flex" }}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  const tonight = getTonight(date);

  const [marker, hand] = await Promise.all([asset("PermanentMarker-400.woff"), asset("PatrickHand-400.woff")]);

  const shown = tonight.shows.slice(0, MAX_SHOWS);
  const extra = tonight.shows.length - shown.length;

  // Photos come from the mics app. One that can't be loaded is left out.
  const urls = [...new Set(shown.flatMap((s) => s.photos.map((p) => p.url)))];
  const loaded = new Map(await Promise.all(urls.map(async (u) => [u, await photoData(u)] as const)));
  const photosFor = (s: TonightShow) =>
    s.photos.flatMap((p) => {
      const src = loaded.get(p.url);
      return src ? [{ name: p.name, src }] : [];
    });
  const n = shown.length;
  const compact = n >= 3;
  const [choreA, choreB] = choresFor(tonight.date);

  // Room for the sticky notes.
  const topH = 120;
  const heroH = compact ? 210 : 360;
  const footerH = 170;
  const gap = 38;
  const cols = n === 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const areaW = W - LEFT - RIGHT;
  const noteW = n === 1 ? 700 : Math.floor((areaW - gap) / 2);
  const areaH = H - topH - heroH - footerH - (extra > 0 ? 44 : 0) - 30;
  const noteH = n ? Math.min(n <= 2 ? 560 : 390, Math.floor((areaH - gap * (rows - 1)) / rows)) : 0;

  const [dayNum, monthName] = tonight.dayMonth.split(" ");
  const heroPx = compact ? 46 : 58;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: PAPER, position: "relative", color: INK }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
        <img src={doodle.paper(W, H)} width={W} height={H} alt="" style={{ position: "absolute", top: 0, left: 0 }} />

        {/* Rubber-stamp date */}
        <div
          style={{
            position: "absolute",
            top: 34,
            right: 46,
            width: 190,
            height: 190,
            borderRadius: 95,
            border: `7px solid ${RED}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: RED,
            fontFamily: "Marker",
            transform: "rotate(-12deg)",
            opacity: 0.92,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, lineHeight: 1 }}>{tonight.weekday.slice(0, 3).toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 66, lineHeight: 1 }}>{dayNum}</div>
          <div style={{ display: "flex", fontSize: 30, lineHeight: 1 }}>{monthName.slice(0, 3).toUpperCase()}</div>
        </div>

        {/* Masthead */}
        <div style={{ display: "flex", alignItems: "center", height: topH, paddingLeft: LEFT, paddingTop: 30 }}>
          <div style={{ display: "flex", fontFamily: "Marker", fontSize: 40 }}>Ministry of Comedy</div>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
          <img src={doodle.sparkle(RED)} width={40} height={40} alt="" style={{ marginLeft: 14 }} />
        </div>

        {/* The to-do list */}
        <div style={{ display: "flex", position: "relative", flexDirection: "column", height: heroH, paddingLeft: LEFT, paddingRight: RIGHT, paddingTop: 14 }}>
          <div style={{ display: "flex", fontFamily: "Marker", fontSize: compact ? 64 : 84, lineHeight: 1.05 }}>
            To-do tonight:
          </div>

          {n === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Hand", fontSize: heroPx, lineHeight: 1.25, marginTop: 14 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex" }}>1.</div>
                <Struck text="go see comedy" px={heroPx} />
                <div style={{ display: "flex", color: RED }}>(no shows tonight)</div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex" }}>2.</div>
                <div style={{ display: "flex" }}>sulk a little</div>
              </div>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex" }}>3.</div>
                <Ticked text="book the weekend" px={heroPx} />
              </div>
            </div>
          ) : compact ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", fontFamily: "Hand", fontSize: heroPx, lineHeight: 1.3, marginTop: 10, gap: 26 }}>
              <Struck text={choreA} px={heroPx} />
              <Struck text={choreB} px={heroPx} />
              <Ticked text="go see comedy" px={heroPx} />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Hand", fontSize: heroPx, lineHeight: 1.25, marginTop: 14 }}>
              {[
                <Struck key="a" text={choreA} px={heroPx} />,
                <Struck key="b" text={choreB} px={heroPx} />,
                <Ticked key="c" text="go see comedy" px={heroPx} />,
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 14 }}>
                  <div style={{ display: "flex" }}>{`${i + 1}.`}</div>
                  {item}
                </div>
              ))}
            </div>
          )}

          {!compact && (
            // eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG
            <img
              src={n ? doodle.mic(INK) : doodle.smiley(INK)}
              width={n ? 150 : 130}
              height={n ? 194 : 130}
              alt=""
              style={{ position: "absolute", right: 90, bottom: 10, transform: "rotate(14deg)" }}
            />
          )}
        </div>

        {/* Sticky notes */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignContent: "center",
            columnGap: gap,
            rowGap: gap,
            flex: 1,
            paddingLeft: LEFT,
            paddingRight: RIGHT,
          }}
        >
          {shown.map((show, i) => (
            <Note key={show.id} show={show} index={i} count={n} width={noteW} height={noteH} photos={photosFor(show)} />
          ))}
          {n === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                position: "relative",
                width: 700,
                background: NOTES[1],
                paddingTop: 56,
                paddingBottom: 48,
                paddingLeft: 44,
                paddingRight: 40,
                transform: "rotate(-2deg)",
                boxShadow: "8px 10px 0 rgba(27,31,59,0.13)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
              <img src={doodle.tape()} width={150} height={48} alt="" style={{ position: "absolute", top: -24, left: 275, transform: "rotate(-5deg)" }} />
              <div style={{ display: "flex", fontFamily: "Marker", fontSize: 62, lineHeight: 1.05 }}>No shows tonight.</div>
              <div style={{ display: "flex", fontFamily: "Hand", fontSize: 44, marginTop: 18, lineHeight: 1.2 }}>
                The mics are resting. The comics are definitely not writing.
              </div>
              <div style={{ display: "flex", fontFamily: "Marker", fontSize: 40, color: RED, marginTop: 22 }}>
                Weekend lineup is up online
              </div>
            </div>
          )}
        </div>

        {extra > 0 && (
          <div style={{ display: "flex", justifyContent: "center", fontFamily: "Hand", fontSize: 32, color: RED, paddingLeft: LEFT, height: 44 }}>
            {`... and ${extra} more on the website`}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", height: footerH, paddingLeft: LEFT, paddingRight: RIGHT, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", fontFamily: "Marker", fontSize: 46 }}>tickets</div>
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
            <img src={doodle.arrow(RED)} width={110} height={66} alt="" style={{ marginLeft: 12, marginRight: 12, marginTop: -16 }} />
            <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
              <div style={{ display: "flex", fontFamily: "Marker", fontSize: 46 }}>ministryofcomedy.in</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
              <img src={doodle.squiggle(RED, 500)} width={500} height={30} alt="" style={{ marginTop: -6 }} />
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "Hand", fontSize: 32, marginTop: 4, opacity: 0.85 }}>
            80 Feet Road, Koramangala. Front row is for the brave.
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Marker", data: marker, weight: 400, style: "normal" },
        { name: "Hand", data: hand, weight: 400, style: "normal" },
      ],
      headers: {
        // Changes when shows.json does (every deploy), so keep caches short.
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
