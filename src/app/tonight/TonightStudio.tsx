"use client";

import { useEffect, useMemo, useState } from "react";

import type { Tonight } from "@/lib/tonight";
import { tonightCaption } from "@/lib/tonightCaption";

import ShareTonight from "./ShareTonight";

const DEFAULT_TODO = "go see comedy";

interface Props {
  /** "date=2026-10-17&v=…": everything the poster URL needs except the ticked line */
  query: string;
  date: string;
  alt: string;
  tonight: Tonight;
  children: React.ReactNode; // the heading, shown above the controls
}

const list = (set: Set<number>) => [...set].sort((a, b) => a - b).join("-");

function toggle(set: Set<number>, i: number): Set<number> {
  const next = new Set(set);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  return next;
}

/**
 * Poster preview + the ticked to-do line + share buttons. Changing the line
 * redraws the preview a moment after you stop typing.
 */
export default function TonightStudio({ query, date, alt, tonight, children }: Props) {
  const [todo, setTodo] = useState(DEFAULT_TODO);
  const [shownTodo, setShownTodo] = useState(DEFAULT_TODO);
  const [bogo, setBogo] = useState<Set<number>>(() => new Set());
  // Sold out starts from BookMyShow's status at the last scrape.
  const [sold, setSold] = useState<Set<number>>(() => new Set(tonight.shows.flatMap((s, i) => (s.soldOut ? [i] : []))));

  const caption = useMemo(
    () => tonightCaption(tonight, { bogo: [...bogo], soldOut: [...sold] }),
    [tonight, bogo, sold]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      const clean = todo.replace(/\s+/g, " ").trim() || DEFAULT_TODO;
      setShownTodo(clean);
    }, 600);
    return () => clearTimeout(t);
  }, [todo]);

  const extra =
    (shownTodo === DEFAULT_TODO ? "" : `&todo=${encodeURIComponent(shownTodo)}`) +
    (bogo.size ? `&bogo=${list(bogo)}` : "") +
    `&sold=${list(sold)}`;
  const posterUrl = `/tonight.jpg?${query}${extra}`;
  const storyUrl = `/tonight.jpg?${query}&format=story${extra}`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-md lg:mx-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated poster, shown as is */}
        <img src={posterUrl} alt={alt} width={1080} height={1350} className="h-auto w-full rounded-xl border border-zinc-800" />
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {children}

        <div className="flex flex-col gap-2">
          <label htmlFor="todo" className="text-sm font-semibold text-zinc-300">
            Ticked line on the to-do list
          </label>
          <div className="flex gap-2">
            <input
              id="todo"
              type="text"
              value={todo}
              maxLength={40}
              onChange={(e) => setTodo(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-yellow-400"
            />
            {todo !== DEFAULT_TODO && (
              <button
                type="button"
                onClick={() => setTodo(DEFAULT_TODO)}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-yellow-400"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500">Up to 40 characters. The preview updates when you stop typing.</p>
        </div>

        {tonight.shows.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-zinc-300">Offers and sold-out shows</legend>
            {tonight.shows.map((s, i) => (
              <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm text-zinc-200">
                  <span className="text-yellow-400">{s.time}</span> · {s.title}
                </span>
                <label className="flex items-center gap-1.5 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={bogo.has(i)}
                    disabled={sold.has(i)}
                    onChange={() => setBogo((b) => toggle(b, i))}
                    className="accent-yellow-400"
                  />
                  BOGO
                </label>
                <label className="flex items-center gap-1.5 text-sm text-zinc-300">
                  <input type="checkbox" checked={sold.has(i)} onChange={() => setSold((x) => toggle(x, i))} className="accent-red-500" />
                  Sold out
                </label>
              </div>
            ))}
            <p className="text-xs text-zinc-500">
              BOGO (Buy 1, Get 1 FREE) goes on the poster, not the story. Sold out goes on both, and the message drops the booking link.
            </p>
          </fieldset>
        )}

        <ShareTonight
          posterUrl={posterUrl}
          fileName={`moc-tonight-${date}.jpg`}
          storyUrl={storyUrl}
          storyFileName={`moc-tonight-story-${date}.jpg`}
          caption={caption}
        />

        <details className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-zinc-300">Message that goes with it</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-zinc-300">{caption}</pre>
        </details>
      </div>
    </div>
  );
}
