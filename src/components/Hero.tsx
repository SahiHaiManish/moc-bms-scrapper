export default function Hero() {
  return (
    <section className="py-24 text-center">
      <h1 className="heading text-7xl md:text-9xl tracking-wide">
        MINISTRY
        <br />
        OF COMEDY
      </h1>

      <p className="mt-6 text-zinc-400 text-lg">
        Bengaluru's Home of Stand-up Comedy
      </p>

      <a
        href="#shows"
        className="inline-block mt-10 rounded-full bg-yellow-400 px-8 py-4 text-black font-semibold hover:scale-105 transition"
      >
        See Tonight's Shows
      </a>
    </section>
  );
}
