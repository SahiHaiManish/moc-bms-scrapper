import { Mail, MapPin } from "lucide-react";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";

export default function Hero() {
  return (
    <section className="relative border-b border-zinc-900">


<div className="relative mx-auto max-w-6xl px-6 py-10">

  {/* Top Row */}

  <div className="mb-12 flex items-center justify-between">

    <a
      href="https://maps.google.com/?q=Ministry+Of+Comedy+Koramangala+Bengaluru"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-medium text-yellow-400 transition hover:text-yellow-300"
    >
      <MapPin size={17} />
      Koramangala, Bengaluru
    </a>

    <div className="flex items-center gap-6 text-zinc-500">

      <a
        href="https://instagram.com/theministryofcomedy"
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-yellow-400"
      >
        <FaInstagram size={22} />
      </a>

      <a
        href="https://wa.me/918317492499"
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-yellow-400"
      >
        <FaWhatsapp size={22} />
      </a>

      <a
        href="mailto:ministryofcomedymail@gmail.com"
        className="transition hover:text-yellow-400"
      >
        <Mail size={21} />
      </a>

    </div>

  </div>

  {/* Heading */}

  <div className="mx-auto max-w-4xl text-center">

    <h1 className="text-5xl font-black leading-[0.9] tracking-tight text-white md:text-6xl lg:text-7xl">
      Ministry of Comedy
    </h1>

    <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-zinc-400">
      Discover every upcoming show at{" "}
      <span className="font-semibold text-white">
        Ministry of Comedy
      </span>.
    </p>

  </div>

</div>


    </section>
  );
}
