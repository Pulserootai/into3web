import { runtime } from "./runtime.js";
import { dispatch } from "./api.js";
export async function handler(event) {
  try {
    const rt = await runtime();
    if (event.source === "aws.events") {
      await rt.service.work();
      return { ok: true };
    }
    const r = await dispatch(rt, {
      method: event.requestContext?.http?.method,
      path:
        event.rawPath +
        (event.rawQueryString ? "?" + event.rawQueryString : ""),
      headers: event.headers,
      raw: event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf8")
        : event.body || "",
      claims: event.requestContext?.authorizer?.jwt?.claims || null,
    });
    return { statusCode: r.status, headers: r.headers, body: r.body };
  } catch (e) {
    if (event.source === "aws.events") throw e;
    console.error("Runtime configuration unavailable");
    return {
      statusCode: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({ error: "Payments are not configured yet." }),
    };
  }
}
