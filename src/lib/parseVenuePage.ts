export interface ShowSummary {
  title: string;
  category: string;
  image: string;
  bookingUrl: string;
  eventId: string;
  language: string[];
}

export function parseVenuePage(html: string): ShowSummary[] {
  const marker = "window.__INITIAL_STATE__ = ";

  const start = html.indexOf(marker);

  if (start === -1) {
    throw new Error("__INITIAL_STATE__ not found");
  }

  const scriptEnd = html.indexOf("</script>", start);

  if (scriptEnd === -1) {
    throw new Error("Couldn't find end of script tag.");
  }

  const script = html.slice(start + marker.length, scriptEnd);

  const state = new Function(
    `"use strict"; return (${script.trim().replace(/;$/, "")});`
  )();

const query = Object.values(state.exploreApi.queries).find(
  (q: any) => q?.data?.listings
) as any;

  if (!query) {
    throw new Error("No listings found.");
  }

  const widget = query.data.listings.find(
    (w: any) => w.id === "listing-desktop-1"
  );

  if (!widget) {
    throw new Error("listing-desktop-1 not found.");
  }

  return widget.cards.map((card: any) => ({
    title: card.text?.[0]?.components?.[0]?.text ?? "",
    category: card.text?.[1]?.components?.[0]?.text ?? "",
    image: card.image?.url ?? "",
    bookingUrl: card.cta?.url ?? "",
    eventId: card.cta?.analytics?.event_code ?? "",
    language: (card.analytics?.language ?? "")
      .split("|")
      .filter(Boolean),
  }));
}
