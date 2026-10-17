/**
 * GET /tonight.png                   tonight's poster, 1080x1350 (WhatsApp, Instagram feed)
 * GET /tonight.png?format=story      1080x1920 (Instagram / WhatsApp story)
 * GET /tonight.png?date=2026-10-17   another night, for previewing
 *
 * The idea: a page torn from a comic's notebook. A to-do
 * list where the boring chores are crossed out and "go see comedy" gets the
 * tick, and every show is a sticky note taped onto the page.
 * Built from public/shows.json, so it always matches the site.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getTonight, type TonightShow } from "@/lib/tonight";

import * as doodle from "./doodles";

/**
 * Story: Instagram covers roughly the top 250px (profile, progress bar) and the
 * bottom 250px (reply box), so everything that matters stays between them.
 */
const FORMATS = {
  post: { W: 1080, H: 1350, safeTop: 0, safeBottom: 0 },
  story: { W: 1080, H: 1920, safeTop: 230, safeBottom: 260 },
} as const;
type Format = (typeof FORMATS)[keyof typeof FORMATS];

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

// Average letter widths (fraction of font size), measured from the font files
// with a little headroom, so text can be fitted before Satori draws it.
const MARKER_W = 0.6;
const HAND_W = 0.42;

/** How many lines `text` wraps to at `px` in a box `width` wide. */
function lineCount(text: string, px: number, width: number, ratio: number): number {
  const space = px * ratio * 0.6;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = word.length * px * ratio;
    if (used === 0) used = w;
    else if (used + space + w <= width) used += space + w;
    else {
      lines++;
      used = w;
    }
  }
  return lines;
}

/** Largest size from `max` down to `min` at which `text` fits in `maxLines`. */
function fit(text: string, max: number, min: number, width: number, maxLines: number, ratio: number) {
  for (let px = max; px > min; px -= 2) {
    const lines = lineCount(text, px, width, ratio);
    if (lines <= maxLines) return { px, lines };
  }
  return { px: min, lines: lineCount(text, min, width, ratio) };
}

/** Starting sizes for a note, by how tall it is. */
function noteBase(height: number) {
  if (height >= 480) return { time: 76, title: 62, names: 40, pad: 46, photo: 240 };
  if (height >= 380) return { time: 60, title: 50, names: 34, pad: 40, photo: 170 };
  if (height >= 320) return { time: 52, title: 44, names: 30, pad: 34, photo: 140 };
  if (height >= 260) return { time: 44, title: 38, names: 27, pad: 28, photo: 112 };
  return { time: 38, title: 32, names: 24, pad: 24, photo: 92 };
}

/** A Polaroid with the name scribbled underneath. */
function Polaroid({ src, name, size, tilt, firstOnly }: { src: string; name: string; size: number; tilt: number; firstOnly: boolean }) {
  const frame = Math.round(size * 0.07);
  // Full name when it fits under the photo, else the first name, shrunk to fit.
  const full = !firstOnly && name.length * Math.round(size * 0.15) * HAND_W <= size;
  const caption = full ? name : name.split(" ")[0];
  const capPx = Math.max(14, Math.min(Math.round(size * 0.15), Math.floor(size / (caption.length * HAND_W))));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexShrink: 0,
        width: size + frame * 2,
        background: "#FFFFFF",
        paddingTop: frame,
        paddingLeft: frame,
        paddingRight: frame,
        paddingBottom: Math.round(frame * 0.5),
        transform: `rotate(${tilt}deg)`,
        boxShadow: "4px 6px 0 rgba(27,31,59,0.2)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered into a PNG */}
      <img src={src} width={size} height={size} alt="" style={{ objectFit: "cover" }} />
      <div style={{ display: "flex", fontFamily: "Hand", fontSize: capPx, color: INK, lineHeight: 1.15, marginTop: Math.round(frame * 0.5) }}>
        {caption}
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

/** Polaroid height for a photo of `size`: frame, caption, and room for the tilt. */
const polaroidH = (size: number) => size * 1.14 + Math.max(18, size * 0.15) * 1.2 + size * 0.08;
/** Width of `count` Polaroids side by side, overlapping a little. */
const polaroidsW = (size: number, count: number) => size * 1.14 * (count === 2 ? 1.92 : 1) + size * 0.06;

/** Fits a names list into `lines` lines of a `width`-wide column. */
function fitNames(names: string[], px: number, width: number, lines: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (let i = 0; i < names.length; i++) {
    const need = lineCount(names[i], px, width, HAND_W);
    const left = names.length - i - 1;
    // keep one line for "+ N more" if anyone would be left out
    const reserve = left > 0 ? 1 : 0;
    // Always show at least one name when there are 2+ lines to work with.
    if (used + need + reserve > lines && !(out.length === 0 && lines >= 2)) {
      out.push(`+ ${names.length - i} more`);
      return out;
    }
    out.push(names[i]);
    used += need;
  }
  return out;
}

const sameName = (a: string, b: string) =>
  a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function Note({
  show,
  index,
  width,
  height,
  photos: wanted,
}: {
  show: TonightShow;
  index: number;
  width: number;
  height: number;
  photos: { name: string; src: string }[];
}) {
  const z = noteBase(height);
  const padL = width >= 600 ? 44 : 32;
  const padR = 26;
  const padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - z.pad - padB;

  // Notes with photos give the photos a little more of the room.
  const shrink = wanted.length ? 0.86 : 1;
  const timePx = Math.round(z.time * shrink);
  const timeH = timePx;
  const gap1 = Math.round(timePx * 0.18);
  const gap2 = 14;

  // Title: full width, 2 lines when there are photos, 3 otherwise.
  const title = posterTitle(show.title);
  const titleFit = fit(title, Math.round(z.title * shrink), Math.round(z.title * 0.55), innerW, wanted.length ? 2 : 3, MARKER_W);
  const titleH = titleFit.lines * titleFit.px * 1.08;
  const rest = innerH - timeH - gap1 - titleH - gap2;

  // Photos: as big as the space left allows, but never squeezing the names out.
  let photos = wanted;
  let size = 0;
  if (photos.length) {
    // Largest photo that fits the height left and keeps 36% of the width for names.
    size = Math.floor(Math.min(z.photo, (innerW * 0.64) / polaroidsW(1, photos.length)));
    while (size >= 70 && polaroidH(size) > rest) size -= 2;
    if (size < 70) photos = []; // no room for a recognisable face: leave them off
  }

  const others = show.performers.filter((n) => !photos.some((p) => sameName(p.name, n)));
  const namesW = photos.length ? innerW - polaroidsW(size, photos.length) - 16 : innerW;
  const namesPx = photos.length ? Math.round(z.names * 0.9) : z.names;
  const nameLines = Math.max(1, Math.floor((photos.length ? polaroidH(size) : rest) / (namesPx * 1.14)) - 1);

  const namesList =
    show.performers.length === 0
      ? ["surprise acts", "(no spoilers)"]
      : others.length
        ? fitNames(others, namesPx, namesW, nameLines)
        : [];
  const label = show.performers.length === 0 ? "with" : photos.length ? "also with" : "with";

  const names =
    namesList.length > 0 ? (
      <div style={{ display: "flex", flexDirection: "column", width: namesW, flexShrink: 0, fontFamily: "Hand", fontSize: namesPx, color: INK, lineHeight: 1.12 }}>
        <div style={{ display: "flex", fontSize: Math.round(namesPx * 0.8), opacity: 0.7 }}>{label}</div>
        {namesList.map((n) => (
          <div key={n} style={{ display: "flex" }}>
            {n}
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width,
        height,
        flexShrink: 0,
        background: NOTES[index % NOTES.length],
        paddingTop: z.pad,
        paddingLeft: padL,
        paddingRight: padR,
        paddingBottom: padB,
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

      <div style={{ display: "flex", flexDirection: "column", width: innerW, height: innerH, overflow: "hidden" }}>
        <div style={{ display: "flex", flexShrink: 0, height: timeH, fontFamily: "Marker", fontSize: timePx, color: RED, lineHeight: 1 }}>
          {show.time.toLowerCase()}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            flexShrink: 0,
            width: innerW,
            marginTop: gap1,
            fontFamily: "Marker",
            fontSize: titleFit.px,
            color: INK,
            lineHeight: 1.08,
          }}
        >
          {title}
        </div>

        {photos.length ? (
          <div style={{ display: "flex", flexShrink: 0, alignItems: "flex-start", marginTop: gap2 + Math.round(size * 0.04), gap: 16 }}>
            <div style={{ display: "flex", flexShrink: 0, width: Math.round(polaroidsW(size, photos.length)), paddingLeft: Math.round(size * 0.04) }}>
              {photos.map((p, i) => (
                <div key={p.src.slice(-24) + i} style={{ display: "flex", flexShrink: 0, marginLeft: i ? -Math.round(size * 0.1) : 0 }}>
                  <Polaroid src={p.src} name={p.name} size={size} tilt={i % 2 ? 5 : -4} firstOnly={photos.length > 1} />
                </div>
              ))}
            </div>
            {names}
          </div>
        ) : (
          <div style={{ display: "flex", flexShrink: 0, marginTop: gap2 }}>{names}</div>
        )}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tonight = getTonight(params.get("date"));
  const fmt: Format = params.get("format") === "story" ? FORMATS.story : FORMATS.post;
  const { W, H, safeTop, safeBottom } = fmt;
  const story = fmt === FORMATS.story;

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
  // The story has room for the full to-do list until the night gets busy.
  const compact = story ? n >= 4 : n >= 3;
  const [choreA, choreB] = choresFor(tonight.date);

  // Room for the sticky notes.
  const topH = 120;
  const heroH = compact ? 210 : 360;
  const footerH = 170;
  const footerGap = 44; // clear space between the notes and the footer
  const gap = 38;
  const cols = story ? (n <= 3 ? 1 : 2) : n === 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const areaW = W - LEFT - RIGHT;
  const noteW = cols === 1 ? (story ? 800 : 700) : Math.floor((areaW - gap) / 2);
  const areaH = H - safeTop - safeBottom - topH - heroH - footerH - footerGap - (extra > 0 ? 44 : 0) - 30;
  const noteH = n ? Math.min(cols === 1 ? 560 : 420, Math.floor((areaH - gap * (rows - 1)) / rows)) : 0;

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
            top: safeTop + 34,
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
        {safeTop > 0 && <div style={{ display: "flex", height: safeTop, flexShrink: 0 }} />}
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
            <Note key={show.id} show={show} index={i} width={noteW} height={noteH} photos={photosFor(show)} />
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

        {/* Footer, with clear space above it */}
        <div style={{ display: "flex", height: footerGap, flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, height: footerH, paddingLeft: LEFT, paddingRight: RIGHT, justifyContent: "center" }}>
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
        {safeBottom > 0 && <div style={{ display: "flex", height: safeBottom, flexShrink: 0 }} />}
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
