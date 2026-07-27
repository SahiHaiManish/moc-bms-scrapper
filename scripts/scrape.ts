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

  console.table(shows);

await fs.writeFile(
  path.join("playwright", "shows.json"),
  JSON.stringify(shows, null, 2)
);

  console.log(`✅ Parsed ${shows.length} shows`);
  
  console.log("✅ Screenshot saved");

  await browser.close();

}

run().catch(console.error);
