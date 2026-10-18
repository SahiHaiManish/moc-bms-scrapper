"use client";

import { useEffect, useState } from "react";

import ShareTonight from "./ShareTonight";

const DEFAULT_TODO = "go see comedy";

interface Props {
  /** "date=2026-10-17&v=…": everything the poster URL needs except the ticked line */
  query: string;
  date: string;
  alt: string;
  caption: string;
  children: React.ReactNode; // the heading, shown above the controls
}

/**
 * Poster preview + the ticked to-do line + share buttons. Changing the line
 * redraws the preview a moment after you stop typing.
 */
export default function TonightStudio({ query, date, alt, caption, children }: Props) {
  const [todo, setTodo] = useState(DEFAULT_TODO);
  const [shownTodo, setShownTodo] = useState(DEFAULT_TODO);

  useEffect(() => {
    const t = setTimeout(() => {
      const clean = todo.replace(/\s+/g, " ").trim() || DEFAULT_TODO;
      setShownTodo(clean);
    }, 600);
    return () => clearTimeout(t);
  }, [todo]);

  const extra = shownTodo === DEFAULT_TODO ? "" : `&todo=${encodeURIComponent(shownTodo)}`;
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
