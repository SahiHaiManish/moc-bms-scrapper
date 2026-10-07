/**
 * Scripts that run INSIDE the BookMyShow page (via page.evaluate).
 *
 * They are plain-JS strings on purpose:
 *   - tsx/esbuild rewrites named functions with a `__name()` helper that does
 *     not exist in the browser, which breaks page.evaluate(fn) with
 *     "ReferenceError: __name is not defined". Strings sidestep that.
 *   - the very same strings can be run under jsdom, so selector logic can be
 *     tested against saved HTML without a browser (scripts/test-dom-scanners.ts).
 *
 * Nothing here relies on BookMyShow class names (they are hashed and change).
 * Everything is matched on visible text, which is far more stable.
 *
 * Both scanners tag the elements they find with data-moc-* attributes so the
 * Node side can click exactly that element afterwards.
 */

/**
 * Finds the date tabs ("TUE 28 JUL", "Fri, 9 Oct", ...).
 * Returns [{ index, label, disabled }] in DOM order.
 *
 * Pass 1 requires a weekday in the text (very low false-positive rate).
 * Pass 2 (only if pass 1 found nothing) accepts bare "28 Jul", but only on
 * elements that look clickable.
 */
export const SCAN_DATE_TABS = String.raw`(function () {
  var skipVis = !!window.__MOC_SKIP_VISIBILITY;

  var WITH_WEEKDAY = /^(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*\d{1,2}(?:st|nd|rd|th)?\s*,?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s*,?\s*\d{4})?$/i;
  var NO_WEEKDAY = /^\d{1,2}(?:st|nd|rd|th)?\s*,?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s*,?\s*\d{4})?$/i;
  var CLICKABLE = 'button,[role="button"],[role="tab"],[role="option"],a,li';

  function text(el) {
    var t = typeof el.innerText === 'string' && el.innerText ? el.innerText : (el.textContent || '');
    return t.replace(/\s+/g, ' ').trim();
  }

  function visible(el) {
    if (skipVis) return true;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  // climb to the outermost wrapper that still contains only this one label
  function outermost(el) {
    var label = text(el);
    var cur = el;
    while (cur.parentElement && cur.parentElement !== document.body && text(cur.parentElement) === label) {
      cur = cur.parentElement;
    }
    return cur;
  }

  function isDisabled(el) {
    if (el.disabled) return true;
    if (el.closest('[aria-disabled="true"],[disabled]')) return true;
    return /(^|[\s_-])disabled([\s_-]|$)/i.test(el.getAttribute('class') || '');
  }

  function collect(regex, mustBeClickable) {
    var nodes = document.querySelectorAll('button,[role="button"],[role="tab"],[role="option"],a,li,div,span,p');
    var seenEls = [];
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visible(el)) continue;
      var t = text(el);
      if (!t || t.length > 24 || !regex.test(t)) continue;
      var target = outermost(el);
      if (mustBeClickable && !target.matches(CLICKABLE) && !target.closest(CLICKABLE)) continue;
      if (seenEls.indexOf(target) !== -1) continue;
      seenEls.push(target);
      out.push({ el: target, label: text(target) });
    }
    return out;
  }

  var old = document.querySelectorAll('[data-moc-date]');
  for (var o = 0; o < old.length; o++) old[o].removeAttribute('data-moc-date');

  var found = collect(WITH_WEEKDAY, false);
  if (!found.length) found = collect(NO_WEEKDAY, true);

  // same label twice (e.g. a desktop + mobile strip both rendered): first wins
  var labels = {};
  var result = [];
  for (var k = 0; k < found.length; k++) {
    var item = found[k];
    if (labels[item.label]) continue;
    labels[item.label] = true;
    var idx = result.length;
    item.el.setAttribute('data-moc-date', String(idx));
    result.push({ index: idx, label: item.label, disabled: isDisabled(item.el) });
  }
  return result;
})()`;

/**
 * Finds the time slots ("9:00 PM", "7:30 PM Fast Filling", "6:00 PM ₹499").
 * Returns [{ time, price, soldOut }] de-duplicated by time, in DOM order.
 */
export const SCAN_TIME_SLOTS = String.raw`(function () {
  var skipVis = !!window.__MOC_SKIP_VISIBILITY;

  var STARTS_WITH_TIME = /^(\d{1,2}:\d{2}\s*[ap]\.?\s*m\.?)(?![a-z])/i;
  var ANY_TIME = /\d{1,2}:\d{2}\s*[ap]\.?\s*m\.?/gi;

  function text(el) {
    var t = typeof el.innerText === 'string' && el.innerText ? el.innerText : (el.textContent || '');
    return t.replace(/\s+/g, ' ').trim();
  }

  function visible(el) {
    if (skipVis) return true;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function isDisabled(el) {
    if (el.disabled) return true;
    if (el.closest('[aria-disabled="true"],[disabled]')) return true;
    return /(^|[\s_-])disabled([\s_-]|$)/i.test(el.getAttribute('class') || '');
  }

  // BookMyShow shows availability as colour only (green = available,
  // orange = fast filling, grey = sold out), with no "sold out" text.
  // Returns 'grey', 'colour', or null when the colour can't be read.
  function tone(el) {
    var cs = window.getComputedStyle(el);
    var raw = cs.borderTopWidth && parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : '';
    var m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/.exec(raw || '');
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    var r = +m[1], g = +m[2], b = +m[3];
    return Math.max(r, g, b) - Math.min(r, g, b) < 24 ? 'grey' : 'colour';
  }

  var nodes = document.querySelectorAll('button,[role="button"],a,li,div,span,p');
  var bySlot = {};
  var order = [];

  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (!visible(el)) continue;

    var t = text(el);
    if (!t || t.length > 80) continue;

    var m = t.match(STARTS_WITH_TIME);
    if (!m) continue;

    // a container holding several times is not a slot
    if ((t.match(ANY_TIME) || []).length !== 1) continue;

    var time = m[1].replace(/\s+/g, ' ').replace(/\./g, '').toUpperCase();
    var priceMatch = t.match(/(?:₹\s*|\b(?:rs\.?|inr)\s*)([\d,]+)/i);
    var soldOut = /sold\s*out|house\s*full|unavailable/i.test(t) || isDisabled(el);

    if (!bySlot[time]) {
      bySlot[time] = { time: time, price: undefined, soldOut: soldOut, tones: [] };
      order.push(time);
    }
    var tn = tone(el);
    if (tn) bySlot[time].tones.push(tn);

    var slot = bySlot[time];
    if (slot.price === undefined && priceMatch) slot.price = Number(priceMatch[1].replace(/,/g, ''));
    // the tightest element (just the time) can't see the "sold out" badge,
    // the wrapper can: if any element for this time says sold out, it is.
    if (soldOut) slot.soldOut = true;
  }

  // Grey only means "sold out" when other slots on the page are coloured:
  // that tells us this page really does encode availability by colour.
  var anyColour = order.some(function (k) { return bySlot[k].tones.indexOf('colour') !== -1; });

  return order.map(function (k) {
    var slot = bySlot[k];
    var onlyGrey = slot.tones.length > 0 && slot.tones.indexOf('colour') === -1;
    if (anyColour && onlyGrey) slot.soldOut = true;
    return { time: slot.time, price: slot.price, soldOut: slot.soldOut };
  });
})()`;
