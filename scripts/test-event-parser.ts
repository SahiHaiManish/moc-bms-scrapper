import fs from "node:fs/promises";
import path from "node:path";

import { parseEventPage } from "../src/lib/parseEventPage";

async function main() {
  const html = await fs.readFile(
    path.join("playwright", "event.html"),
    "utf8"
  );

  const event = parseEventPage(html);

  console.dir(event, {
    depth: null,
    colors: true,
  });
}

main().catch(console.error);
