# Alok — deployment handoff

This ZIP contains the complete current landing-site source, all images/assets, checkout/admin UI, Node.js reservation backend, tests and AWS SAM infrastructure. It is a source package, not an already deployed AWS service. No credentials or customer data are included.

## Start here

1. Install Node.js 22+, AWS CLI and AWS SAM CLI; sign in with a deployment IAM/SSO identity, not root access keys.
2. Extract the ZIP and open the `into3-landing` folder. Run `npm ci`, `npm test`, and `npm run check`.
3. For local use, copy `backend/env.example` to `.env`. Supply credentials securely and independent random token/admin/webhook secrets. `.env` is intentionally absent from this ZIP. Start with `PAYMENTS_ENABLED=false`; enable only test mode after configuration. `npm start` serves frontend and backend at http://localhost:8801.
4. Follow PAYMENTS-SETUP.md for AWS setup. Run `node infra/package.mjs` before SAM build; it creates the Lambda package from source. No need to transfer node_modules.

## Frontend pages

- `dist/index.html`: original landing page.
- `dist/introduction.html`: introduction/PDF-inspired variation.
- `dist/scientific.html`: RTAE-led variation.
- `dist/learn-more.html`: shared details and demo requests.
- `dist/founding-offer.html`: reservation terms.
- `dist/checkout.html`: customer checkout and reservation management.
- `dist/orders-admin.html`: restricted order/refund administration.

Upload the CONTENTS of `dist/` to the static web root (not backend or project root). All images are in dist/assets. The AWS SAM template deploys the API, storage and admin identity infrastructure; it does NOT deploy the frontend or custom-domain DNS. For a full AWS move, host dist on private S3 behind CloudFront with HTTPS, and configure DNS. The existing Sites frontend can alternatively stay in place and call the AWS API.

Preserve `/`, `/introduction`, `/scientific`, `/learn-more`, `/founding-offer`, `/checkout` and `/orders-admin` as clean URLs, alongside their .html versions. Configure a CloudFront viewer-request rewrite for these exact paths to their .html files (and `/` to `/index.html`); preserve query strings. Do not use a generic index.html SPA fallback. Serve assets unchanged. Cognito redirect/logout must use the exact `/orders-admin.html` URL documented in the template.

Set the final HTTPS frontend origin as SAM SiteOrigin. Set dist/config.js apiBaseUrl and adminAuth.domain/clientId from stack outputs, then publish the frontend. API CORS allows the exact configured origin. Keep secrets out of dist. Use separate test/live stacks and buckets.

## Credentials and external setup

- Obtain Razorpay test/live credentials directly from Abhin securely. Rotate the test secret previously shared in chat before team reuse. It is NOT included.
- Store API/signing credentials in AWS Secrets Manager; follow PAYMENTS-SETUP.md. Retain TOKEN_SECRET safely: it signs customer reservation-management links.
- Verify SES domain/DKIM and production sending access for orders@into3.ai. Both customer confirmations and internal notices are implemented; actual email delivery has not been accepted yet.
- Configure Razorpay webhooks and capture settings. Create Cognito admins with MFA. Confirm the SNS email subscription for operations alerts.
- Published policy links still point to into3.ai; preserve or intentionally migrate them.

## Agreed business settings

₹100 reservation, inclusive of applicable tax. One introductory month on activation, then six paid months at ₹1,399/month; the ₹100 advance reduces the first paid bill to ₹1,299. No automatic subscription mandate. Planned launch December 2026–January 2027. Full refund if launch misses 31 January 2027; parents can also cancel before the deadline. Staff initiate eligible cancellation refunds within 24 hours, with bank settlement additional. Staff issue refunds in Razorpay; the app verifies and records their references.

Merchant: DEEPSCIENCE COGNITECH AI LABS PRIVATE LIMITED. GSTIN 09AAMCD7848L1ZS. Correct address supplied by owner: A-116, First Floor, Urbtech Trade Centre, Sector 132, Noida, Uttar Pradesh 201304. CA team handles tax compliance; acknowledgement emails are not GST invoices.

WhatsApp: +918796989996. Meta Pixel 1547708980458861 runs PageView on five marketing pages; checkout/admin do not include it. Server-side CAPI and Purchase conversion tracking remain separate unfinished work. Do not treat modal opens as paid conversions.

## Acceptance before enabling live collection

Local checks already completed: 19 backend tests, browser flow/mobile checks, npm dependency audit, cfn-lint, real Razorpay test-order creation, and forged-signature rejection. These do not establish live readiness.

Complete a deployed sandbox payment with verified capture, duplicate webhook replay, failed/dismissed checkout, lost-callback recovery, customer/team email receipt, unauthorised admin rejection, cancellation, manual refund and refund-status confirmation. Load-test the S3 ledger under expected campaign traffic; it is a bounded cohort ledger, not a high-throughput database. Review storage retention/version cleanup and SES bounce handling. See documented limits in PAYMENTS-SETUP.md. Enable live credentials only after deployed acceptance and business checks; perform an authorised live payment/refund acceptance before ad traffic.

## Files not included

.env, API secrets, AWS credentials, .data, local reservation records, certificates, .git history, node_modules, generated build directories and browser session data. The local setup document mentions a developer .env: Alok must create his own from backend/env.example.
