import { parseEventPage } from "../src/lib/parseEventPage";
import { parseVenuePage } from "../src/lib/parseVenuePage";
import { chromium, Page, BrowserContext } from "playwright";
import fs from "fs/promises";
import path from "path";

const VENUE_URL =
  "https://in.bookmyshow.com/explore/c/venues/ministry-of-comedy-koramangala/mcbk";

const STORAGE_FILE = "playwright/chromium-state.json";

async function getContext(browser: any): Promise<BrowserContext> {
  try {
    await fs.access(STORAGE_FILE);

    console.log("✅ Using saved browser state");

    return await browser.newContext({
      storageState: STORAGE_FILE,
    });

  } catch {

    console.log("🆕 Starting fresh browser");

    return await browser.newContext();
  }
}

async function chooseBengaluru(page: Page, context: BrowserContext) {

  try {

    await page.waitForSelector("text=Bengaluru", {
      timeout: 4000,
    });

    console.log("📍 Selecting Bengaluru");

    await page.getByText("Bengaluru", {
      exact: true,
    }).click();

    await page.waitForLoadState("networkidle");

    await context.storageState({
      path: STORAGE_FILE,
    });

    console.log("💾 Browser state saved");

  } catch {

    console.log("👍 City already selected");

  }

}

async function saveEventPage(page: Page, url: string) {
  console.log("\n🎭 Opening first event...\n");

await page.goto(url, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});

// Give React time to render the page.
await page.waitForTimeout(5000);

console.log(await page.title());
console.log(page.url());

  await page.screenshot({
    path: "playwright/event.png",
    fullPage: true,
  });

  const html = await page.content();

  await fs.writeFile(
    path.join("playwright", "event.html"),
    html
  );

  console.log("✅ Saved event.html");
}

async function fetchEventDetails(page: Page, url: string) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForTimeout(5000);

  const html = await page.content();

  try {
  return parseEventPage(html);
} catch (error) {
  const slug =
    url.split("/").filter(Boolean).at(-1) ?? "unknown";

  await fs.writeFile(
    `playwright/failed-${slug}.html`,
    html
  );

  throw error;
}
}

async function run() {

  const browser = await chromium.launch({
  headless: false,

  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",

  channel: undefined,

  args: [
    "--disable-blink-features=AutomationControlled",
  ],
});
  
const context = await getContext(browser);

  const page = await context.newPage();

  await page.goto(VENUE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await chooseBengaluru(page, context);

  await page.waitForTimeout(3000);

  await page.screenshot({
    path: "playwright/latest.png",
    fullPage: true,
  });

  const html = await page.content();

  const shows = parseVenuePage(html);

const finalShows = [];

for (let i = 0; i < shows.length; i++) {
  const summary = shows[i];

  console.log(
    `\n[${i + 1}/${shows.length}] ${summary.title}`
  );

  try {
    const details = await fetchEventDetails(
      page,
      summary.bookingUrl
    );

    finalShows.push({
      ...summary,
      ...details,
    });

    console.log("✅ Parsed");

  } catch (error) {
    console.error("❌ Failed:", summary.bookingUrl);

    console.error(error);
  }

  // Be polite to BookMyShow
  await page.waitForTimeout(1500);
}

await fs.mkdir("data", {
  recursive: true,
});

await fs.writeFile(
  path.join("data", "raw-shows.json"),
  JSON.stringify(finalShows, null, 2)
);

console.log(
  `\n✅ Saved ${finalShows.length} shows to data/raw-shows.json`
); 
 
  console.log("✅ Screenshot saved");

  await browser.close();

}

run().catch(console.error);
