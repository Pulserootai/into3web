# Into3 reservation backend

Implemented 26 September 2026. The public frontend is Sites-hosted; the AWS backend is prepared, not deployed. A Razorpay test-mode order was created successfully (INR 10000 paise, status created). No charge, refund or customer email has been sent during development.

## Included

- Node.js/Express local server; Lambda HTTP API handler for AWS.
- Razorpay Standard Checkout with server-fixed INR 10000 paise, inclusive of applicable tax.
- POST `/api/create-order`, `/api/verify-payment`, `/api/order-status`, `/api/cancel-order`, `/api/webhook`.
- Per-checkout idempotency, ownership tokens, HMAC signature verification, provider-side captured-status/amount/currency verification, delayed-payment reconciliation.
- Parent contact/class/state, accepted offer version, confirmed reservation and advance-credit records. No student answers or physiological data.
- Private S3 ledger with conditional ETag writes; local atomic file store for one development process. No database tables introduced.
- Durable customer/team email outbox using SES with retries and delivery leases. Confirmation, cancellation and refund status emails.
- Cognito admin authorization, MFA, order pagination/CSV export, overdue refund flags, verified manual refund tracking, explicit missed-launch refund queue.
- SAM template, private versioned bucket, scoped IAM, schedule, logs and worker-error alarm.
- Separate checkout/admin pages without Meta Pixel. Marketing PageView remains; CAPI/Purchase tracking is NOT implemented by this payment integration.

## Local setup

1. Use Node.js 22 or newer. Run `npm ci`.
2. A Git-ignored `.env` exists at the project root. The supplied test Key ID/Secret are stored there and were used only to verify test-order creation. Rotate the shared test secret before further team use and replace it here; add a separate random webhook secret. Local token/admin secrets have been generated without printing them.
3. Local test mode is configured with `PAYMENTS_ENABLED=true`; keep public/live payment activation disabled until deployed acceptance passes. Keep `EMAIL_MODE=disabled` for local work unless explicitly configuring SES. The example environment is `backend/env.example`.
4. Run `npm start`; open `http://localhost:8801/checkout.html`. Server binds loopback only. Set frontend `apiBaseUrl` blank for same-origin local API.
5. Make an official Razorpay test-mode payment; do not enter real card data. Check that captured verification confirms the reservation and that dismissing the modal does not.
6. Restart the server after environment changes. Local state is `.data/reservations.json` (ignored). Do not use FileStore with multiple server processes or in Lambda.
7. Admin: `http://localhost:8801/orders-admin.html`, using the local `.env` ADMIN_TOKEN. This local token fallback is explicitly disabled in Lambda.

## AWS setup (requires account sign-in)

Use a separate stack/secret/bucket for test and live. The ledger refuses to mix test and live orders. Suggested region: ap-south-1; verify SES service/account availability.

1. Configure an AWS CLI profile using SSO; install AWS SAM CLI. Do not share root credentials.
2. In Secrets Manager, create a JSON secret containing `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `TOKEN_SECRET` (at least 32 random characters), and `PAYMENTS_ENABLED` (string `false` initially). Optional CA-provided `TAX_RATE_PERCENT` is reserved for future tax-document integration; current emails are payment acknowledgements, NOT GST tax invoices. Rotate a compromised token secret only with a customer-link migration plan.
3. Run `node infra/package.mjs`. This copies only backend code and dependency manifests to `build/payment-api`; `.env`, ledger and certificates are excluded.
4. Run `sam validate --lint --template-file infra/template.yaml` and `sam build --template-file infra/template.yaml`.
5. Run `sam deploy --guided` with SiteOrigin, SecretArn and a unique AdminDomainPrefix. Review IAM changes. This creates billable AWS resources. Source authorization includes deployment, but no AWS session is available in this environment yet.
6. Set `dist/config.js` apiBaseUrl to stack ApiUrl; adminAuth.domain/clientId to AdminDomainUrl/AdminClientId. Republish frontend. No secret belongs in this file.
7. Create the administrator in the Cognito pool and add to `admins`; complete password setup and TOTP MFA through sign-in. Admin callbacks must exactly match `/orders-admin.html` on SiteOrigin.
8. Verify `into3.ai` in SES (DKIM records), configure SPF/DMARC appropriately for the chosen mail setup, and request SES production access if sandboxed. Confirm SES can send from orders@into3.ai and receive internal notices there. Verify SNS subscription sent to orders@into3.ai for alarm notifications.
9. Configure Razorpay webhook URL `ApiUrl/api/webhook`, with the same webhook secret. Subscribe to `payment.captured`, `order.paid`, `refund.processed`, `refund.failed`. Enable appropriate automatic capture in Razorpay. Test webhook delivery and duplicate retries.
10. Enable payments in the test stack secret and redeploy/recycle Lambda instances: runtime caches secrets for a warm instance. Verify one complete test payment, restart/recovery, SES customer/internal delivery, Cognito access denial, cancellation and refund.
11. Repeat with a separate live stack/secret. Set live keys only in Secrets Manager; perform an authorised live acceptance payment and refund before campaign traffic.

## Operations

- Refunds are initiated by staff in Razorpay Dashboard, never automatically by this application. Record the `rfnd_...` ID in admin; backend fetches it and checks payment and full INR 100 amount. Webhooks/scheduled reconciliation also update status. Never mark refunded solely from a staff-entered string.
- Check refund requests daily; 24-hour initiation is the team's service commitment. Bank settlement is outside this service. A launch-missed queue requires explicit admin confirmation after 31 January 2027; it does not infer whether product launch happened.
- The 5,000 cap is applied transactionally at confirmation. A payment that races for the final place is recorded as refund due, not silently dropped. Customer sees that possibility before payment.
- Uncertain Razorpay create requests are retained and reconciled by receipt instead of creating duplicate orders. If no matching provider order appears, investigate in Razorpay before deleting/resetting an attempt. Definitive 400/401 creation failures permit same-attempt retry after correction.
- Email delivery is **at least once**: a crash after SES accepts a message but before its acknowledgement is saved can result in a duplicate. Provider delivery/bounce tracking is not yet connected; outbox `sent` means SES accepted it, not that it reached the inbox.
- The S3 ledger is deliberately bounded to this cohort (20,000 total checkout attempts). Each operation reads/writes a ledger snapshot. It is not a high-throughput database substitute: load-test against expected campaign bursts in AWS before launch, and migrate the store adapter if contention/latency is unacceptable. Admission throttling does not establish per-person uniqueness; separate intentional reservations are allowed.
- Reserve no place merely on page view or modal open. Persisted successful payment is the source of truth. No conversion event should fire on a failed, dismissed or pending checkout.
- Bucket versions support recovery but contain personal data. Set retention/deletion policy with the business and account for noncurrent versions in deletion workflows. Never put this bucket behind a public website.

## Verification and current limits

`npm test` checks server-controlled amount, consent validation, duplicate create, forged signatures, authorised-versus-captured status, ownership, raw webhook HMAC, idempotent replay, cancellation race, provider-verified refunds, email retry, lost-callback recovery, provider auth errors, full-capacity race, launch deadline, admin/origin guards, local durability and S3 conflicts.

Browser checks use intercepted mock payment responses (no live transaction): disabled configuration, checkout creation, modal dismiss, payment failure, verification success, mobile 320/390px layouts and admin login gate. Screenshots are under ignored `verification/`.

Full Razorpay sandbox payment/capture/refund acceptance, AWS deployment/IAM/S3 concurrency, Cognito login, SES delivery and real refund acceptance remain unverified until rotated credentials, account sign-in and DNS configuration are provided. No production-readiness certification is claimed from local mocks.

CloudFormation/SAM template passed cfn-lint. Real local HTTP `/api/create-order` returned 200 with a Razorpay test order for 10000 paise; `/api/verify-payment` rejected a forged signature with 400.
