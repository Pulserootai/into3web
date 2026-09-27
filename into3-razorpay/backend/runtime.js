import Razorpay from "razorpay";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { FileStore, S3Store } from "./store.js";
import { Reservations } from "./service.js";
let cached;
function sesSender() {
  const ses = new SESv2Client({});
  return ({ from, to, subject, text }) =>
    ses.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: { Text: { Data: text, Charset: "UTF-8" } },
          },
        },
      }),
    );
}
function resendSender(apiKey) {
  return async ({ from, to, subject, text }) => {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error("Resend rejected email: HTTP " + r.status);
  };
}
export async function runtime() {
  if (cached) return cached;
  let secrets = {};
  if (process.env.SECRET_ARN) {
    const r = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({ SecretId: process.env.SECRET_ARN }),
    );
    secrets = JSON.parse(r.SecretString);
  }
  const env = { ...process.env, ...secrets };
  const config = {
    enabled: env.PAYMENTS_ENABLED === "true",
    keyId: env.RAZORPAY_KEY_ID || "",
    keySecret: env.RAZORPAY_KEY_SECRET || "",
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || "",
    tokenSecret: env.TOKEN_SECRET || "",
    origin: env.ALLOWED_ORIGIN || "http://localhost:8801",
    site: env.SITE_URL || "http://localhost:8801",
    adminToken: env.ADMIN_TOKEN || "",
    taxRate: env.TAX_RATE_PERCENT || null,
  };
  if (
    config.enabled &&
    (!config.keyId ||
      !config.keySecret ||
      config.tokenSecret.length < 32 ||
      !config.webhookSecret)
  )
    throw new Error("Payment configuration incomplete");
  const gateway =
    config.keyId && config.keySecret
      ? new Razorpay({ key_id: config.keyId, key_secret: config.keySecret })
      : {};
  if (gateway.api?.rq) gateway.api.rq.defaults.timeout = 10000;
  const store = env.LEDGER_BUCKET
    ? new S3Store(env.LEDGER_BUCKET)
    : new FileStore();
  if (process.env.AWS_LAMBDA_FUNCTION_NAME && !env.LEDGER_BUCKET)
    throw new Error("Durable ledger required");
  let mailer = null;
  // EMAIL_MODE=resend sends through the Resend HTTP API (RESEND_API_KEY in the
  // secret); EMAIL_MODE=ses uses Amazon SES. Without a usable transport the
  // outbox keeps emails pending and delivers them once one is configured.
  const send =
    env.EMAIL_MODE === "ses"
      ? sesSender()
      : env.EMAIL_MODE === "resend" && env.RESEND_API_KEY
        ? resendSender(env.RESEND_API_KEY)
        : null;
  if (send) {
    mailer = async (o, kind, token) => {
      const manage = `${config.site}/checkout.html#reference=${encodeURIComponent(o.id)}&token=${token}`;
      const confirmation = o.status === "confirmed";
      const subject =
        kind === "refund"
          ? "Your Into3 refund has been processed"
          : kind === "cancellation"
            ? "Into3 cancellation request received"
            : kind === "missedLaunch"
              ? "Into3 launch-delay refund"
              : confirmation
                ? "Your Into3 founding-family reservation"
                : "Your Into3 payment and refund status";
      const text = [
        `Hello ${o.customer.name},`,
        subject,
        `Reference: ${o.id}`,
        `Payment: ${o.paymentId || "not yet confirmed"}`,
        `Reservation amount: INR 100, inclusive of applicable tax.`,
        `Status: ${o.status}. Refund: ${o.refundStatus || "not requested"}.`,
        confirmation
          ? "Access is planned for December 2026–January 2027; it is not available immediately. One introductory month is included on activation, followed by six paid months at INR 1,399/month. Your INR 100 advance is credited to the first paid bill (INR 1,299). Subsequent planned price: INR 1,499/month. No automatic subscription mandate has been created."
          : "Eligible full refunds are manually initiated by our team within 24 hours of cancellation requests. Bank or payment-provider settlement takes additional time.",
        `Manage your reservation: ${manage}`,
        "DEEPSCIENCE COGNITECH AI LABS PRIVATE LIMITED",
        "GSTIN: 09AAMCD7848L1ZS",
        "A-116, First Floor, Urbtech Trade Centre, Sector 132, Noida, Uttar Pradesh 201304",
        "This is a payment acknowledgement, not a tax invoice. Contact orders@into3.ai.",
      ].join("\n\n");
      const team = kind.endsWith("Team") || kind === "team";
      await send({
        from: env.EMAIL_FROM || "orders@into3.ai",
        to: team ? env.EMAIL_TO || "orders@into3.ai" : o.customer.email,
        subject: (team ? "[Into3 operations] " : "") + subject,
        text,
      });
    };
  }
  cached = {
    service: new Reservations({ store, gateway, config, mailer }),
    config,
  };
  return cached;
}
