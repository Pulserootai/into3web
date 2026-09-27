import { timingSafeEqual } from "node:crypto";
import { TERMS, fail } from "./service.js";
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  a.length > 0 &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export async function dispatch({ service, config }, request) {
  const { method, headers = {}, raw = "", claims = null } = request;
  const url = new URL(request.path, "https://api.into3.invalid");
  const path = url.pathname;
  const origin = headers.origin;
  const responseHeaders = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  };
  // ALLOWED_ORIGIN may list several comma-separated origins (e.g. the
  // CloudFront default domain alongside https://into3.ai during DNS cutover).
  const allowed = String(config.origin || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.includes(origin))
    responseHeaders["Access-Control-Allow-Origin"] = origin;
  try {
    if (origin && !allowed.includes(origin)) fail(403, "Origin not allowed.");
    if (method === "OPTIONS")
      return {
        status: 204,
        headers: {
          ...responseHeaders,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, Idempotency-Key",
        },
        body: "",
      };
    if (Buffer.byteLength(raw) > 16384) fail(413, "Request too large.");
    const bearer = (headers.authorization || "").replace(/^Bearer /, "");
    const admin = () => {
      if (claims) {
        const groups = claims["cognito:groups"];
        if (
          !(Array.isArray(groups)
            ? groups.includes("admins")
            : String(groups || "")
                .split(/[,\s\[\]"]+/)
                .includes("admins"))
        )
          fail(403, "Administrator access required.");
        return claims.sub;
      }
      if (
        !process.env.AWS_LAMBDA_FUNCTION_NAME &&
        config.adminToken?.length >= 32 &&
        equal(bearer, config.adminToken)
      )
        return "local-admin";
      fail(401, "Administrator sign-in required.");
    };
    let body = {};
    if (method === "POST" && path !== "/api/webhook") {
      try {
        body = JSON.parse(raw);
      } catch {
        fail(400, "Invalid JSON.");
      }
      if (!body || Array.isArray(body) || typeof body !== "object")
        fail(400, "Invalid request.");
    }
    let result;
    if (path === "/api/config" && method === "GET")
      result = {
        enabled: config.enabled,
        amount: 10000,
        currency: "INR",
        termsVersion: TERMS,
        mode: config.keyId.startsWith("rzp_live_") ? "live" : "test",
      };
    else if (path === "/api/create-order" && method === "POST")
      result = await service.create(body, headers["idempotency-key"]);
    else if (path === "/api/verify-payment" && method === "POST")
      result = await service.verify(body, bearer);
    else if (path === "/api/order-status" && method === "POST")
      result = await service.status(body.reference, bearer);
    else if (path === "/api/cancel-order" && method === "POST")
      result = await service.cancel(body.reference, bearer);
    else if (path === "/api/webhook" && method === "POST")
      result = await service.webhook(raw, headers["x-razorpay-signature"]);
    else if (path === "/api/admin/orders" && method === "GET") {
      admin();
      const search = (url.searchParams.get("q") || "").slice(0, 100).toLowerCase();
      const all = (await service.list()).filter(o => !search ||
        [o.reference, o.customer.name, o.customer.email, o.customer.phone, o.paymentId]
          .some(value => String(value || "").toLowerCase().includes(search)));
      const cursor = url.searchParams.get("cursor") || "";
      const index = cursor
        ? all.findIndex((o) => o.reference === cursor) + 1
        : 0;
      if (cursor && index === 0) fail(400, "Invalid cursor.");
      const page = all.slice(index, index + 100);
      result = {
        orders: page,
        nextCursor: index + 100 < all.length ? page.at(-1).reference : null,
      };
    } else if (path === "/api/admin/refund" && method === "POST")
      result = await service.recordRefund(
        body.reference,
        body.refundId,
        admin(),
      );
    else if (path === "/api/admin/missed-launch" && method === "POST") {
      const actor = admin();
      if (body.confirm !== "LAUNCH_MISSED")
        fail(400, "Explicit missed-launch confirmation required.");
      result = await service.missedLaunch(actor);
    } else fail(404, "Route not found.");
    return {
      status: 200,
      headers: responseHeaders,
      body: JSON.stringify(result),
    };
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500)
      console.error("API failure", { path, status, name: e.name });
    return {
      status,
      headers: responseHeaders,
      body: JSON.stringify({
        error:
          status >= 500
            ? "Service temporarily unavailable. Please retry without paying again."
            : e.message,
      }),
    };
  }
}
