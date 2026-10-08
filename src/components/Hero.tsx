import { Mail, MapPin } from "lucide-react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";

export default function Hero() {
  return (
    <section className="relative border-b border-zinc-900">


<div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">

  {/* Top Row */}

  <div className="mb-6 flex items-center justify-between sm:mb-12">

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

  {/* Heading */}

  <div className="mx-auto max-w-4xl text-center">

    <h1 className="text-balance text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
      Ministry of Comedy
    </h1>

{/*    
<p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-zinc-400">
      Discover every upcoming show at{" "}
      <span className="font-semibold text-white">
        friendly neighbourhood comedy club!
      </span>
    </p>
*/}

  </div>

</div>

<div className="mb-6 px-4 text-center sm:mb-4">
 <div className="text-2xl tracking-wide text-yellow-400 sm:text-3xl">
    ★★★★★
  </div>

<a
  href="https://share.google/DsCYkBi48Sc6vIX0a"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-block py-2 transition-opacity hover:opacity-80"
>
  <p className="text-base text-zinc-300">
    Rated <span className="font-semibold text-white">4.5</span> on Google
  </p>
</a>

  <blockquote className="mt-1 text-base italic text-zinc-300 sm:mt-5 sm:text-lg">
    "Great little room."
  </blockquote>

  <div className="text-sm text-zinc-500">
    — Daniel Sloss
  </div>
</div>

    </section>
  );
}
