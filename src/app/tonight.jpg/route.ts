import { renderPoster } from "../tonight.png/poster";

/**
 * GET /tonight.jpg: the poster as JPEG, about a third the size of the PNG.
 * Same query as /tonight.png (?format=story, ?date=, ?todo=).
 *
 * Uses sharp, which Next.js installs with itself. If it's ever missing, the
 * PNG is sent instead so sharing still works.
 */
export async function GET(request: Request) {
  const png = await renderPoster(new URL(request.url).searchParams);
  const headers = { "Cache-Control": png.headers.get("Cache-Control") ?? "public, max-age=0, s-maxage=300" };

  try {
    const { default: sharp } = await import("sharp");
    const jpg = await sharp(Buffer.from(await png.clone().arrayBuffer()))
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(jpg), { headers: { ...headers, "Content-Type": "image/jpeg" } });
  } catch (err) {
    console.error("tonight.jpg: JPEG conversion failed, sending PNG:", (err as Error).message);
    return new Response(await png.arrayBuffer(), { headers: { ...headers, "Content-Type": "image/png" } });
  }
}
