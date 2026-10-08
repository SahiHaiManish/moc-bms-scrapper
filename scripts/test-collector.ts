/**
 * Runs collectSessions() against a fake Playwright Page backed by jsdom, so the
 * click loop can be tested without a browser.   npx tsx scripts/test-collector.ts
 * (needs: npm i -D jsdom @types/jsdom)
 */
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import { collectSessions } from "./collectSessions";
import { buildSessions } from "./lib/sessions";

const NOW = new Date("2026-10-07T11:00:00+05:30");

function fakePage(html: string, redirectToVenue?: string) {
  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://in.bookmyshow.com/" });
  const win: any = dom.window;
  win.__MOC_SKIP_VISIBILITY = true;
  const gotos: string[] = [];

  const page: any = {
    goto: async (u: string) => { gotos.push(redirectToVenue ? u.replace("/MCBK", `/${redirectToVenue}`) : u); },
    url: () => gotos.at(-1) ?? "",
    waitForTimeout: (ms: number) => new Promise((r) => setTimeout(r, Math.min(ms, 50))),
    waitForResponse: () => new Promise((r) => setTimeout(() => r(null), 30)),
    evaluate: async (s: any) => JSON.parse(JSON.stringify(win.eval(s))),
    content: async () => dom.serialize(),
    screenshot: async () => {},
    on() {}, off() {},
    locator: (sel: string) => ({
      first: () => ({
        scrollIntoViewIfNeeded: async () => {},
        click: async () => win.document.querySelector(sel).click(),
        evaluate: async (f: any) => f(win.document.querySelector(sel)),
      }),
    }),
  };
  return { page, gotos };
}

async function run(name: string, html: string, expected: string[]) {
  const { page, gotos } = fakePage(html);
  const raw = await collectSessions(page, "https://in.bookmyshow.com/events/x/ET1?webview=true", {
    eventId: "ET1",
    fallbackDateIso: "2026-10-09T22:00:00+05:30",
  });
  const sessions = buildSessions(raw, { eventId: "ET1", durationMinutes: 90, now: NOW });

  assert.equal(gotos[0], "https://in.bookmyshow.com/events/x/ET1/date-time/MCBK");
  assert.deepEqual(sessions.map((s) => `${s.date} ${s.time}`), expected);
  console.log(`  ✓ ${name}`);
}

const DATA = `{"Fri 09 Oct":["10:00 PM","11:59 PM"],"Sat 10 Oct":["10:00 PM"],"Sun 11 Oct":["11:59 PM"]}`;

const SCRIPT = (delay: number) => `<script>
  var data=${DATA};
  function show(k){document.getElementById('slots').innerHTML=(data[k]||[]).map(function(t){return '<div>'+t+'</div>'}).join('');}
  show("Fri 09 Oct");
  setTimeout(function(){
    var s=document.getElementById('strip');
    Object.keys(data).forEach(function(k){var d=document.createElement('div');d.textContent=k;
      d.addEventListener('click',function(){show(k)});s.appendChild(d);});
  }, ${delay});
</script>`;

const EXPECTED = [
  "Fri 9 Oct 10:00 PM", "Fri 9 Oct 11:59 PM", "Sat 10 Oct 10:00 PM", "Sun 11 Oct 11:59 PM",
];

async function refuses(name: string, html: string, venue: string) {
  const { page } = fakePage(html, venue);

  await assert.rejects(
    collectSessions(page, "https://in.bookmyshow.com/events/x/ET1", { eventId: "ET1" }),
    new RegExp(`venue ${venue}`)
  );
  console.log(`  ✓ ${name}`);
}

(async () => {
  console.log("collectSessions");
  const shell = (delay: number) =>
    `<body><div id="strip"></div><div id="slots"></div>${SCRIPT(delay)}</body>`;

  await run("date strip already rendered", shell(0), EXPECTED);
  // regression: pills render first, date strip a moment later -> used to return Friday only
  await run("date strip renders AFTER the time pills", shell(1500), EXPECTED);
  // regression: an event sold at several venues must not leak another venue's showtimes
  await refuses("redirected to another venue's date-time page is refused", shell(0), "XYZ1");
  console.log("\ncollector tests passed");
})();
