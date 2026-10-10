import Image from "next/image";
import { Mail, MapPin } from "lucide-react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";

/**
 * The logo, from /public. Set to null to show the name as text instead.
 * width/height are the file's real pixel size (used for the aspect ratio).
 */
const LOGO: { src: string; width: number; height: number } | null = {
  src: "/logowogo.png",
  width: 4500,
  height: 1350,
};

/**
 * Centred masthead on wide screens (1024px+): where-we-are on the left, logo in
 * the middle, social proof on the right, so both sides weigh the same.
 * Below that (phones AND tablets) it stacks: location + icons, logo, rating,
 * quote. A wide wordmark needs the room, or the side text starts to wrap.
 */
export default function Hero() {
  return (
    <section className="relative border-b border-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">

        <div className="flex flex-col items-center gap-1 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6">

          {/* Left wing: location, then ways to reach us */}

          <div className="order-1 flex w-full items-center justify-between lg:col-start-1 lg:row-start-1 lg:w-auto lg:flex-col lg:items-start lg:justify-self-start">

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

            <div className="-mr-2.5 flex items-center text-zinc-500 sm:gap-2 lg:-ml-2.5 lg:mr-0">

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

          {/* Centre: the brand */}

          <h1 className="order-2 text-3xl font-black leading-none tracking-tight text-white sm:text-4xl lg:col-start-2 lg:row-start-1 lg:text-5xl">
            {LOGO ? (
              <Image
                src={LOGO.src}
                alt="Ministry of Comedy"
                width={LOGO.width}
                height={LOGO.height}
                priority
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 214px, 187px"
                className="block h-14 w-auto sm:h-16 lg:h-24"
              />
            ) : (
              "Ministry of Comedy"
            )}
          </h1>

          {/* Right wing: social proof */}

          <div className="order-3 flex flex-col items-center lg:col-start-3 lg:row-start-1 lg:items-end lg:justify-self-end">

            <a
              href="https://share.google/DsCYkBi48Sc6vIX0a"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 py-2.5 transition-opacity hover:opacity-80"
            >
              <span aria-hidden className="text-lg leading-none tracking-wider text-yellow-400">
                ★★★★★
              </span>

              <span className="text-sm text-zinc-300">
                Rated <span className="font-semibold text-white">4.5</span> on Google
              </span>
            </a>

            <p className="text-sm text-zinc-500 lg:text-right">
              <span className="italic text-zinc-300">&quot;Great little room.&quot;</span>
              {" "}— Daniel Sloss
            </p>

          </div>

        </div>

      </div>
    </section>
  );
}
