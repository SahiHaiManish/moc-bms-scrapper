"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, ExternalLink, Users, X } from "lucide-react";
import { FaInstagram } from "react-icons/fa";

import { Comic, LineupEntry, emojiFor, instagramEmbedUrl, loadComics, resolveLineup } from "@/lib/comics";

interface Props {
  /** show title, used as the dialog heading */
  title: string;
  /** performer names as listed by BookMyShow */
  performers: string[];
}

function Avatar({ entry }: { entry: LineupEntry }) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-800 ring-1 ring-zinc-700">
      {entry.photo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.photo}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center text-2xl leading-none"
        >
          {emojiFor(entry.name)}
        </span>
      )}
    </div>
  );
}

const reelPill =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 ring-1 ring-zinc-700 transition hover:bg-pink-500/15 hover:text-pink-200 hover:ring-pink-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400";

/** The reel, playing inside the dialog. Leaving this view removes the iframe, which stops the video. */
function ReelPlayer({ entry, embedUrl }: { entry: LineupEntry; embedUrl: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto overscroll-contain">
      <div className="relative mx-auto h-[min(68vh,40rem)] w-full shrink-0 bg-black">
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
            Loading reel…
          </div>
        )}

        <iframe
          src={embedUrl}
          title={`${entry.name} on Instagram`}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          className="relative h-full w-full border-0 bg-black"
        />
      </div>

      {/* private or non-embeddable reels show an Instagram error inside the frame: this is the way out */}
      <a
        href={entry.reel}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 border-t border-zinc-800 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:text-white"
      >
        <ExternalLink size={15} />
        Not playing? Open in Instagram
      </a>
    </div>
  );
}

/**
 * "View lineup" box for a show card. Opens a dialog listing every comic on the
 * bill with a small photo and, when we have one, a Reel button that plays the
 * reel right inside the dialog. The roster is only downloaded the first time
 * someone shows interest.
 */
export default function LineupDialog({ title, performers }: Props) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState<Comic[]>([]);
  const [playing, setPlaying] = useState<LineupEntry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    loadComics().then((list) => !cancelled && setRoster(list));

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Native <dialog>: Esc, focus trapping and the top layer come for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    if (!dialog.open) dialog.showModal();

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (performers.length === 0) return null;

  const lineup = resolveLineup(performers, roster);
  const playingEmbed = playing ? instagramEmbedUrl(playing.reel) : undefined;

  const closeAll = () => {
    dialogRef.current?.close();
    setOpen(false);
    setPlaying(null);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={() => void loadComics()}
        onFocus={() => void loadComics()}
        className="mt-2 flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3.5 py-2.5 text-left transition hover:border-yellow-400/70 hover:bg-zinc-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 sm:mt-3"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-400">
          <Users size={16} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">View lineup</span>
          <span className="block text-xs text-zinc-500">
            {performers.length} {performers.length === 1 ? "comic" : "comics"} on the bill
          </span>
        </span>

        <ChevronRight size={18} className="shrink-0 text-zinc-500" />
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          aria-labelledby="lineup-title"
          onClose={() => {
            setOpen(false);
            setPlaying(null);
          }}
          onClick={(e) => {
            // a click on the dimmed backdrop lands on the <dialog> element itself
            if (e.target === dialogRef.current) closeAll();
          }}
          className="m-auto max-h-[92vh] w-[min(94vw,28rem)] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-0 text-white shadow-2xl shadow-black backdrop:bg-black/75 backdrop:backdrop-blur-sm"
        >
          <div className="flex max-h-[92vh] flex-col">
            <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3.5 sm:px-5">
              {playing && (
                <button
                  type="button"
                  onClick={() => setPlaying(null)}
                  aria-label="Back to lineup"
                  className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
                >
                  <ArrowLeft size={20} />
                </button>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-yellow-400">
                  {playing ? "Reel" : "Lineup"}
                </p>
                <h2 id="lineup-title" className="mt-1 line-clamp-2 text-lg font-bold leading-snug">
                  {playing ? playing.name : title}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeAll}
                aria-label="Close lineup"
                className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
              >
                <X size={20} />
              </button>
            </header>

            {playing && playingEmbed ? (
              <ReelPlayer entry={playing} embedUrl={playingEmbed} />
            ) : (
              <ul className="divide-y divide-zinc-800/70 overflow-y-auto overscroll-contain px-4 sm:px-5">
                {lineup.map((entry) => {
                  const embed = instagramEmbedUrl(entry.reel);

                  return (
                    <li key={entry.name} className="flex items-center gap-3 py-3">
                      <Avatar entry={entry} />

                      <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">
                        {entry.name}
                      </span>

                      {entry.reel &&
                        (embed ? (
                          <button
                            type="button"
                            onClick={() => setPlaying(entry)}
                            aria-label={`Play ${entry.name}'s reel`}
                            className={reelPill}
                          >
                            <FaInstagram size={14} className="text-pink-400" />
                            Reel
                          </button>
                        ) : (
                          // a profile link or anything else that can't be embedded
                          <a
                            href={entry.reel}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Watch ${entry.name} on Instagram`}
                            className={reelPill}
                          >
                            <FaInstagram size={14} className="text-pink-400" />
                            Reel
                          </a>
                        ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
