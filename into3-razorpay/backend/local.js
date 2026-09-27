import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { runtime } from "./runtime.js";
import { dispatch } from "./api.js";
const app = express();
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use("/api", express.text({ type: "*/*", limit: "16kb" }));
app.use("/api", async (req, res) => {
  try {
    const r = await dispatch(await runtime(), {
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      raw: req.body || "",
    });
    res.status(r.status).set(r.headers).send(r.body);
  } catch {
    res.status(503).json({ error: "Payment configuration is not ready." });
  }
});
app.use(express.static("dist", { extensions: ["html"] }));
app.use((err, req, res, next) =>
  res
    .status(err.status || 500)
    .json({ error: "Request could not be processed." }),
);
app.listen(Number(process.env.PORT || 8801), "127.0.0.1", () =>
  console.log("Into3 checkout: http://localhost:" + (process.env.PORT || 8801)),
);
const worker = setInterval(async () => {
  try {
    await (await runtime()).service.work();
  } catch {
    console.error("Worker unavailable");
  }
}, 60000);
worker.unref();
