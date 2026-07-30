"use client";

interface Props {
  items: string[];
}

export default function WeekendTicker({ items }: Props) {
  const text = ["🎤 THIS WEEKEND", ...items].join(" • ");

  return (
    <div className="relative my-8 overflow-hidden border-y border-zinc-800 py-3">
      <div className="ticker whitespace-nowrap">
        <span>{text}</span>
        <span className="ml-12">{text}</span>
      </div>
    </div>
  );
}
