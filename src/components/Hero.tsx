import Image from "next/image";
import { Mail, MapPin } from "lucide-react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";

/**
 * Your logo. Put the file in /public and point this at it, e.g. "/logo.png"
 * (PNG, SVG, WebP all work; any shape). Until then the name is shown as text.
 */
const LOGO_SRC: string | null = null;

export default function Hero() {
  return (
    <section className="relative border-b border-zinc-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        {/* Top bar: where we are + how to reach us */}

        <div className="flex items-center justify-between">

          <a
            href="https://maps.google.com/?q=Ministry+Of+Comedy+Koramangala+Bengaluru"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 py-2.5 text-sm font-medium text-yellow-400 transition hover:text-yellow-300"
          >
            <MapPin size={17} />
            <span>
              Koramangala<span className="hidden min-[380px]:inline">, Bengaluru</span>
            </span>
          </a>

          <div className="-mr-2.5 flex items-center text-zinc-500 sm:gap-2">

            <a
              href="https://instagram.com/theministryofcomedy"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 transition hover:text-yellow-400"
            >
              <FaInstagram size={22} aria-label="Instagram" />
            </a>

            <a
              href="https://wa.me/918317492499"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 transition hover:text-yellow-400"
            >
              <FaWhatsapp size={22} aria-label="WhatsApp" />
            </a>

            <a
              href="mailto:ministryofcomedymail@gmail.com"
              className="p-2.5 transition hover:text-yellow-400"
            >
              <Mail size={21} aria-label="Email" />
            </a>

          </div>

        </div>

        {/* Brand on the left, social proof on the right (stacked on phones) */}

        <div className="flex flex-col gap-2 pb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pb-6">

          <h1 className="shrink-0 text-3xl font-black leading-none tracking-tight text-white sm:text-4xl lg:text-5xl">
            {LOGO_SRC ? (
              // fixed box + object-contain: any logo shape fits without distortion
              <span className="relative block h-11 w-60 sm:h-14 sm:w-72 lg:h-16 lg:w-80">
                <Image
                  src={LOGO_SRC}
                  alt="Ministry of Comedy"
                  fill
                  priority
                  sizes="(min-width: 1024px) 320px, (min-width: 640px) 288px, 240px"
                  className="object-contain object-left"
                />
              </span>
            ) : (
              "Ministry of Comedy"
            )}
          </h1>

          <div className="flex flex-col sm:items-end">

            <a
              href="https://share.google/DsCYkBi48Sc6vIX0a"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 py-2.5 transition-opacity hover:opacity-80 sm:py-2"
            >
              <span aria-hidden className="text-lg leading-none tracking-wider text-yellow-400">
                ★★★★★
              </span>

              <span className="text-sm text-zinc-300">
                Rated <span className="font-semibold text-white">4.5</span> on Google
              </span>
            </a>

            <p className="text-sm text-zinc-500 sm:text-right">
              <span className="italic text-zinc-300">&quot;Great little room.&quot;</span>
              {" "}— Daniel Sloss
            </p>

          </div>

        </div>

      </div>
    </section>
  );
}
