import { Page } from "playwright";

export interface TicketInfo {
  startDate?: string;
  date?: string;
  time?: string;

  price?: number;

  availability?: "available" | "sold_out";
}

export async function parseTicketPage(
  page: Page
): Promise<TicketInfo> {

  const text = await page.locator("body").innerText();

  //
  // ------------------------------------------
  // PRICE
  // ------------------------------------------
  //

  let price: number | undefined;

  const priceMatch = text.match(/₹\s*([\d,]+)/);

  if (priceMatch) {
    price = Number(
      priceMatch[1].replace(/,/g, "")
    );
  }

  //
  // ------------------------------------------
  // DATE
  // ------------------------------------------
  //

  let date: string | undefined;

  const datePatterns = [

    // Sat, 14 Jun
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}\s+[A-Za-z]{3,9}\b/i,

    // 14 Jun
    /\b\d{1,2}\s+[A-Za-z]{3,9}\b/i,

  ];

  for (const pattern of datePatterns) {

    const match = text.match(pattern);

    if (match) {
      date = match[0];
      break;
    }

  }

  //
  // ------------------------------------------
  // TIME
  // ------------------------------------------
  //

  let time: string | undefined;

  const timeMatch = text.match(
    /\b\d{1,2}:\d{2}\s?(AM|PM)\b/i
  );

  if (timeMatch) {
    time = timeMatch[0];
  }

  //
  // ------------------------------------------
  // AVAILABILITY
  // ------------------------------------------
  //

  let availability: "available" | "sold_out" =
    "available";

  if (
    /sold out/i.test(text) ||
    /housefull/i.test(text) ||
    /not available/i.test(text)
  ) {
    availability = "sold_out";
  }

  //
  // ------------------------------------------
  // START DATE
  //
  // We'll construct a proper ISO timestamp later,
  // once we know exactly how BookMyShow formats
  // the final ticket page.
  // ------------------------------------------
  //

  return {
    date,
    time,
    price,
    availability,
  };
}
