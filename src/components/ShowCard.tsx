import { Show } from "@/types/show";

import Image from "next/image";

interface Props {
  show: Show;
}

export default function ShowCard({ show }: Props) {
  return (
    <a
      href={show.bookingUrl}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-2xl bg-zinc-900 transition hover:scale-[1.02]"
    >
     
	<div className="relative h-64 w-full">
  <Image
    src={
     show.image ||
     "/placeholder.jpg"
    }
    alt={show.title}
    fill
    className="object-cover"
    sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 33vw"
  />
</div> 

      <div className="p-6">
        <p className="text-yellow-400">
          {show.startTime}
        </p>

        <h2 className="mt-2 text-2xl font-bold">
          {show.title}
        </h2>
	
	<div
  className="
  mt-6
  inline-flex
  items-center
  rounded-full
  bg-yellow-400
  px-5
  py-3
  font-semibold
  text-black
"
>
  Book Tickets →
</div>
		
      </div>
    </a>
  );
}
