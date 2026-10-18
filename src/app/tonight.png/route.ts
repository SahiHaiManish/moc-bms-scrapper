import { renderPoster } from "./poster";

/** GET /tonight.png: the poster as PNG. /tonight.jpg is the same, smaller. */
export async function GET(request: Request) {
  return renderPoster(new URL(request.url).searchParams);
}
