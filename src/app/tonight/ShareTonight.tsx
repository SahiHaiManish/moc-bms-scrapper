"use client";

import { useState } from "react";

interface Props {
  posterUrl: string;
  fileName: string;
  storyUrl: string;
  storyFileName: string;
  caption: string;
}

const btn =
  "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:opacity-50";

/**
 * Phones: one Share button sends the poster AND the message to WhatsApp, where
 * you pick the groups. Laptops (no file sharing): download the poster, copy
 * the message, or open WhatsApp with the message.
 */
export default function ShareTonight({ posterUrl, fileName, storyUrl, storyFileName, caption }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function imageFile(url: string, name: string): Promise<File> {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Couldn't load the poster");
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || "image/jpeg" });
  }

  // Stories take just the image: Instagram ignores text sent with it.
  async function shareStory() {
    setBusy(true);
    setStatus(null);
    try {
      const data = { files: [await imageFile(storyUrl, storyFileName)] };
      if (navigator.canShare?.(data)) {
        await navigator.share(data);
        setStatus("Pick Instagram (or WhatsApp) and post it to your story.");
      } else {
        setStatus("This browser can't share files. Download the story image instead.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    setBusy(true);
    setStatus(null);
    try {
      const file = await imageFile(posterUrl, fileName);
      const data = { files: [file], text: caption };
      if (navigator.canShare?.(data)) {
        // WhatsApp keeps the text as the image's caption on Android; on iPhone it
        // sometimes drops it, so the message is also copied, ready to paste.
        await navigator.clipboard?.writeText(caption).catch(() => {});
        await navigator.share(data);
        setStatus("Shared. If the message didn't come along, it's copied: paste it after the poster.");
      } else {
        setStatus("This browser can't share files. Download the poster and copy the message instead.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setStatus("Message copied.");
    } catch {
      setStatus("Couldn't copy automatically. Open “Message that goes with it” below and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={share} disabled={busy} className={`${btn} bg-yellow-400 text-black hover:bg-yellow-300`}>
          {busy ? "Preparing…" : "Share poster + message"}
        </button>
        <a href={posterUrl} download={fileName} className={`${btn} border border-zinc-700 text-white hover:border-yellow-400`}>
          Download poster
        </a>
        <button type="button" onClick={copy} className={`${btn} border border-zinc-700 text-white hover:border-yellow-400`}>
          Copy message
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(caption)}`}
          target="_blank"
          rel="noreferrer"
          className={`${btn} border border-zinc-700 text-white hover:border-yellow-400`}
        >
          WhatsApp (text only)
        </a>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={shareStory} disabled={busy} className={`${btn} border border-yellow-400 text-yellow-300 hover:bg-yellow-400/10`}>
          Share story (1080×1920)
        </button>
        <a href={storyUrl} download={storyFileName} className={`${btn} border border-zinc-700 text-white hover:border-yellow-400`}>
          Download story
        </a>
      </div>
      {status && <p className="text-sm text-zinc-400">{status}</p>}
    </div>
  );
}
