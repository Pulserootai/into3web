// Meta Pixel + Conversions API glue for every into3.ai page.
// Loaded right after the pixel base code. It initialises the pixel, fires
// PageView (and ViewContent on key pages) with an eventID, and sends the same
// event to /api/track so the server copy deduplicates against the browser one.
// Pages call window.into3Meta.track()/context() for Lead, checkout and purchase.
(function () {
  "use strict";
  var PIXEL = "1547708980458861";
  var YEAR = 365 * 864e5, NINETY_DAYS = 90 * 864e5;
  var onInto3 = /(^|\.)into3\.ai$/.test(location.hostname);

  function getCookie(name) {
    var m = document.cookie.match("(?:^|; )" + name + "=([^;]*)");
    return m ? decodeURIComponent(m[1]) : "";
  }
  function setCookie(name, value, maxAgeMs) {
    document.cookie = name + "=" + encodeURIComponent(value) + "; Max-Age=" + Math.floor(maxAgeMs / 1000) +
      "; Path=/; SameSite=Lax" + (onInto3 ? "; Domain=.into3.ai; Secure" : "");
  }
  function hex(bytes) {
    return Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return hex(crypto.getRandomValues(new Uint8Array(16)));
  }
  function store(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  }

  // _fbc from an ad click (keep fbclid exactly as received; replace only when it changes).
  var fbclid = new URLSearchParams(location.search).get("fbclid");
  if (fbclid && getCookie("_fbc").split(".").slice(3).join(".") !== fbclid)
    setCookie("_fbc", "fb.1." + Date.now() + "." + fbclid, NINETY_DAYS);
  // _fbp in Meta's format so the pixel adopts it and the server sees it on the first hit.
  if (!getCookie("_fbp"))
    setCookie("_fbp", "fb.1." + Date.now() + "." + Math.floor(1e9 + Math.random() * 9e9), NINETY_DAYS);
  // Stable first-party visitor ID, used as external_id. It is a random 64-hex
  // value, so Meta treats it as already hashed on both browser and server.
  var vid = getCookie("_i3vid");
  if (!/^[a-f0-9]{64}$/.test(vid)) vid = hex(crypto.getRandomValues(new Uint8Array(32)));
  setCookie("_i3vid", vid, 2 * YEAR);

  // Hashed email/phone saved after a form submission (never raw values).
  var am = load("_i3am");

  function context() {
    return { fbp: getCookie("_fbp"), fbc: getCookie("_fbc"), vid: vid, url: location.href, am: am };
  }

  // Automatic button/form events would duplicate the explicit ones below without an eventID.
  fbq("set", "autoConfig", false, PIXEL);
  var match = { external_id: vid };
  if (am.em) match.em = am.em;
  if (am.ph) match.ph = am.ph;
  fbq("init", PIXEL, match);

  function send(path, body) {
    try {
      fetch(path, {
        method: "POST", keepalive: true, credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).catch(function () {});
    } catch (e) {}
  }

  // track(name, data, {eventId, server}) fires the pixel with an eventID and,
  // when server is true, relays the same event to /api/track.
  function track(name, data, opts) {
    opts = opts || {};
    var eventId = opts.eventId || name.replace(/[a-z]/g, "").toLowerCase() + "_" + uuid();
    fbq("track", name, data || {}, { eventID: eventId });
    if (opts.server) {
      var c = context();
      send("/api/track", { event_name: name, event_id: eventId, custom_data: data || {},
        url: c.url, fbp: c.fbp, fbc: c.fbc, vid: c.vid, am: c.am });
    }
    return eventId;
  }

  // Normalise and SHA-256 email/phone in the browser, then keep only the hashes
  // for advanced matching on later pages.
  function remember(email, phone) {
    if (!window.crypto || !crypto.subtle) return;
    var digest = function (v) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)).then(function (b) { return hex(new Uint8Array(b)); });
    };
    var e = String(email || "").trim().toLowerCase();
    var p = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
    if (p.length === 10) p = "91" + p;
    Promise.all([e ? digest(e) : "", p.length >= 11 ? digest(p) : ""]).then(function (h) {
      if (h[0]) am.em = h[0];
      if (h[1]) am.ph = h[1];
      store("_i3am", JSON.stringify(am));
    }).catch(function () {});
  }

  window.into3Meta = { track: track, context: context, remember: remember, eventId: function (p) { return p + "_" + uuid(); } };

  track("PageView", {}, { server: true });

  var path = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
  var VIEW = {
    "/price-page": ["Pricing", "pricing"],
    "/features": ["Features", "product"],
    "/how-it-works": ["How it works", "product"],
    "/benefits": ["Benefits", "product"],
    "/landingpages/prelaunch/founding-offer": ["Founding-family offer", "pricing"],
    "/landingpages/prelaunch/learn-more": ["Learn more", "product"],
    "/landingpages/prelaunch/checkout": ["Founding-family reservation", "checkout"]
  }[path];
  if (VIEW)
    track("ViewContent", { content_name: VIEW[0], content_category: VIEW[1], content_ids: [path.split("/").pop()], content_type: "product" }, { server: true });
})();
