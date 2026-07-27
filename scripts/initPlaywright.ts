import { chromium } from "playwright";

async function run() {

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  await page.goto(
    "https://in.bookmyshow.com",
    {
      waitUntil: "networkidle",
    }
  );

  console.log("");
  console.log("👇");
  console.log("Select Bengaluru manually.");
  console.log("Wait until you're redirected.");
  console.log("Then press ENTER here.");
  console.log("");

  process.stdin.resume();

  process.stdin.once("data", async () => {

    await context.storageState({
      path: "playwright/storageState.json",
    });

    console.log("✅ Saved browser state.");

    await browser.close();

    process.exit();

  });

}

run();
