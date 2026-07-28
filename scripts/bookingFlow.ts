import { Page, Locator } from "playwright";
import fs from "fs/promises";

const PAUSE = 1000;
const MAX_STEPS = 20;

export async function reachTicketPage(page: Page) {
  console.log("🚀 Resolving booking flow...");

  for (let step = 1; step <= MAX_STEPS; step++) {
    console.log(`\n===== Booking Step ${step} =====`);

    await page.waitForTimeout(PAUSE);

    if (await isTicketPage(page)) {
      console.log("🎟 Ticket page reached");
      return;
    }

    const book = await findBookButton(page);

    if (book) {
      console.log("👉 Book Now");

      await book.scrollIntoViewIfNeeded().catch(() => {});
      await book.click({ force: true });

      continue;
    }

    const modal = await getVisibleDialog(page);

    if (!modal) {
      await dumpFailure(page, "unknown-page");
      throw new Error("Booking dialog not found.");
    }

    //
    // Bengaluru
    //

    const city = modal
      .getByText(/^Bengaluru$/i)
      .first();

    if (await city.isVisible().catch(() => false)) {
      console.log("📍 Bengaluru");

      await city.click();

      continue;
    }

    //
    // Ministry Of Comedy
    //

    const ministry = modal
      .locator("text=/Ministry\\s*Of\\s*Comedy/i")
      .first();

    if (await ministry.isVisible().catch(() => false)) {
      console.log("🎭 Ministry Of Comedy");

      await ministry.click();

      continue;
    }

    //
    // Any venue
    //

    const venue = await findVenue(modal);

    if (venue) {
      const txt = await venue.innerText().catch(() => "");

      console.log("🎭", txt.trim());

      await venue.click();

      continue;
    }

    //
    // Date
    //

    const date = await findDate(modal);

    if (date) {
      const txt = await date.innerText().catch(() => "");

      console.log("📅", txt.trim());

      await date.click();

      continue;
    }

    //
    // Time
    //

    const time = await findTime(modal);

    if (time) {
      const txt = await time.innerText().catch(() => "");

      console.log("🕒", txt.trim());

      await time.click();

      continue;
    }

    //
    // Generic buttons
    //

    const generic = await findClickable(modal);

    if (generic) {
      const txt = await generic.innerText().catch(() => "");

      console.log("👉", txt.trim());

      await generic.click();

      continue;
    }

    await dumpFailure(page, `booking-step-${step}`);

    throw new Error(
      "Unable to understand booking dialog."
    );
  }

  throw new Error(
    "Booking flow exceeded maximum steps."
  );
}

async function isTicketPage(page: Page) {
  const selectors = [
    "text=Select Tickets",
    "text=Select seats",
    "text=Quantity",
    "text=Tickets",
    "text=How many tickets",
    "text=Available Tickets",
  ];

  for (const s of selectors) {
    if (
      await page
        .locator(s)
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      return true;
    }
  }

  return false;
}

async function findBookButton(
  page: Page
): Promise<Locator | null> {
  const selectors = [
    "button:has-text('Book')",
    "[role='button']:has-text('Book')",
    "text=/Book\\s*Now/i",
    "text=/Book/i",
  ];

  for (const s of selectors) {
    const l = page.locator(s).first();

    if (
      await l.isVisible().catch(() => false)
    ) {
      return l;
    }
  }

  return null;
}

async function getVisibleDialog(
  page: Page
): Promise<Locator |null> {

  const dialogs =
    page.locator("[role='dialog']");

  const count =
    await dialogs.count();

  for (let i = count - 1; i >= 0; i--) {

    const d = dialogs.nth(i);

    if (
      await d.isVisible().catch(() => false)
    ) {
      return d;
    }

  }

  return null;
}

async function findVenue(
  modal: Locator
): Promise<Locator | null> {

  const rows = modal
    .locator("button,[role='button'],li,div");

  const count =
    await rows.count();

  for (let i = 0; i < count; i++) {

    const row = rows.nth(i);

    const txt =
      (await row.innerText().catch(() => ""))
        .trim();

    if (!txt)
      continue;

    if (
      /comedy/i.test(txt) ||
      /club/i.test(txt) ||
      /koramangala/i.test(txt)
    ) {
      return row;
    }

  }

  return null;
}

async function findDate(
  modal: Locator
): Promise<Locator | null> {

  const buttons =
    modal.locator("button");

  const count =
    await buttons.count();

  for (let i = 0; i < count; i++) {

    const b = buttons.nth(i);

    const txt =
      (await b.innerText().catch(() => ""))
        .trim();

    if (
      /\b\d{1,2}\b/.test(txt) ||
      /\bJan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec\b/i.test(txt)
    ) {
      return b;
    }

  }

  return null;
}

async function findTime(
  modal: Locator
): Promise<Locator | null> {

  const buttons =
    modal.locator("button");

  const count =
    await buttons.count();

  for (let i = 0; i < count; i++) {

    const b = buttons.nth(i);

    const txt =
      (await b.innerText().catch(() => ""))
        .trim();

    if (
      /\d{1,2}:\d{2}\s*(AM|PM)/i.test(txt)
    ) {
      return b;
    }

  }

  return null;
}

async function findClickable(
  modal: Locator
): Promise<Locator | null> {

  const buttons =
    modal.locator("button");

  const count =
    await buttons.count();

  for (let i = 0; i < count; i++) {

    const b = buttons.nth(i);

    if (
      await b.isVisible().catch(() => false)
    ) {
      return b;
    }

  }

  return null;
}

async function dumpFailure(
  page: Page,
  name: string
) {

  await fs.mkdir("playwright", {
    recursive: true,
  });

  await page.screenshot({
    path: `playwright/${name}.png`,
    fullPage: true,
  });

  await fs.writeFile(
    `playwright/${name}.html`,
    await page.content()
  );

  console.log(
    `📸 Saved ${name}`
  );
}
