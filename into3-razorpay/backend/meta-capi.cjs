// Meta Conversions API client shared by the reservations API (ESM import) and
// the website forms Lambda (require). CommonJS so both can load it.
// Config (env or Secrets Manager): META_CAPI_TOKEN, META_PIXEL_ID,
// META_API_VERSION, META_TEST_EVENT_CODE (testing only).
"use strict";
const { createHash, randomUUID } = require("node:crypto");

const sha = (v) => createHash("sha256").update(v).digest("hex");
const HASHED = /^[a-f0-9]{64}$/;

// Normalise per Meta's customer-information rules; return "" when unusable.
const norm = {
  em: (v) => String(v || "").trim().toLowerCase(),
  ph: (v) => {
    let d = String(v || "").replace(/\D/g, "").replace(/^0+/, "");
    if (d.length === 10) d = "91" + d; // Indian mobile without country code
    return d.length >= 11 && d.length <= 15 ? d : "";
  },
  name: (v) => String(v || "").trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""),
  loc: (v) => String(v || "").trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""),
  zp: (v) => String(v || "").trim().toLowerCase().replace(/\s/g, ""),
};

const splitName = (full) => {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  return { fn: parts[0] || "", ln: parts.length > 1 ? parts.at(-1) : "" };
};

// Build user_data. `hashed` accepts values the browser already hashed
// (em/ph/external_id); only well-formed SHA-256 strings are forwarded.
function userData(u = {}) {
  const out = {};
  const put = (key, value) => {
    if (value) (out[key] ??= []).includes(value) || out[key].push(value);
  };
  if (u.ip) out.client_ip_address = u.ip;
  if (u.ua) out.client_user_agent = u.ua;
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  for (const e of [].concat(u.em || [])) { const n = norm.em(e); if (n) put("em", sha(n)); }
  for (const p of [].concat(u.ph || [])) { const n = norm.ph(p); if (n) put("ph", sha(n)); }
  const fn = norm.name(u.fn), ln = norm.name(u.ln);
  if (fn) put("fn", sha(fn));
  if (ln) put("ln", sha(ln));
  const ct = norm.loc(u.ct), st = norm.loc(u.st), zp = norm.zp(u.zp);
  if (ct) put("ct", sha(ct));
  if (st) put("st", sha(st));
  if (zp) put("zp", sha(zp));
  if (u.country) put("country", sha(norm.loc(u.country)));
  if (u.externalId) put("external_id", sha(String(u.externalId)));
  for (const [key, values] of Object.entries(u.hashed || {}))
    if (["em", "ph", "external_id"].includes(key))
      for (const v of [].concat(values || []))
        if (HASHED.test(v)) put(key, v);
  return out;
}

// First X-Forwarded-For entry is the visitor (CloudFront -> API Gateway append after it).
function clientIp(headers = {}, fallback = "") {
  const h = (k) => headers[k] ?? headers[k.toLowerCase()];
  const xff = String(h("x-forwarded-for") || "").split(",")[0].trim();
  return h("cloudfront-viewer-address")?.replace(/:\d+$/, "") || xff || fallback || "";
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|lighthouse|headlesschrome|pingdom|uptime|monitor|preview|curl|wget|python-requests|axios|node-fetch/i;
const isBot = (ua) => !ua || BOT.test(ua);

// Browser-supplied identifiers: accept only the documented cookie formats.
const cleanFbp = (v) => (/^fb\.\d\.\d{10,13}\.\d{5,20}$/.test(v || "") ? v : undefined);
const cleanFbc = (v) => (/^fb\.\d\.\d{10,13}\.[\w.-]{10,500}$/.test(v || "") ? v : undefined);
const cleanId = (v) => (/^[\w.:-]{8,100}$/.test(v || "") ? v : undefined);
const cleanUrl = (v) => {
  try {
    const u = new URL(String(v || ""));
    return /^https?:$/.test(u.protocol) ? u.href.slice(0, 1000) : undefined;
  } catch {
    return undefined;
  }
};

function config(env = process.env) {
  return {
    token: env.META_CAPI_TOKEN || "",
    pixelId: env.META_PIXEL_ID || "1547708980458861",
    version: env.META_API_VERSION || "v26.0",
    testCode: env.META_TEST_EVENT_CODE || "",
  };
}

// Send one event. Never throws: tracking must not break forms or payments.
// Retries network failures and 5xx once. Returns true when Meta accepted it.
async function send(event, cfg = config(), fetchImpl = fetch) {
  if (!cfg.token) return false;
  const body = {
    data: [{ action_source: "website", event_time: Math.floor(Date.now() / 1000), ...event }],
    ...(cfg.testCode ? { test_event_code: cfg.testCode } : {}),
  };
  const url = `https://graph.facebook.com/${cfg.version}/${cfg.pixelId}/events?access_token=${encodeURIComponent(cfg.token)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });
      const res = await r.json().catch(() => ({}));
      console.log("[meta-capi]", event.event_name, event.event_id, r.status,
        res.events_received ?? "", res.fbtrace_id || res.error?.fbtrace_id || "", res.error?.message || "");
      if (r.ok) return true;
      if (r.status < 500) return false;
    } catch (e) {
      console.error("[meta-capi]", event.event_name, event.event_id, "network", e.name);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

const eventIdFallback = (prefix) => prefix + "_" + randomUUID();

module.exports = { eventIdFallback, userData, clientIp, isBot, splitName, send, config, sha, norm, cleanFbp, cleanFbc, cleanId, cleanUrl };
