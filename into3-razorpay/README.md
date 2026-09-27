# Into3 founding-family website and reservation backend

The frontend is static HTML/CSS/JavaScript under `dist/`. A Node.js backend under `backend/` supports Razorpay checkout locally and AWS Lambda deployment. See [PAYMENTS-SETUP.md](PAYMENTS-SETUP.md) for setup, endpoint coverage, testing and remaining external acceptance steps. The public frontend remains on Sites. AWS deployment and public payment activation have not happened.

Run `npm ci`, configure the ignored `.env`, then `npm start` (localhost:8801). Run `npm test` for backend checks. Never publish `.env`, `.data`, credentials or certificate PDFs. The AWS package script excludes them.

## Included

- Five-question hero carousel, pause/manual controls and reduced-motion support.
- Interactive adaptation scenarios and AI-agent panels with keyboard navigation.
- Ecosystem, illustrative learning journey, existing animal identities, benefits, sourced comparison, pricing, founding offer, FAQs and privacy/terms dialogs.
- Three custom AI-generated conceptual images. They are not testimonials, product screenshots or proof of outcomes. Animal assets reused from the existing Into3 identity module. Sources: `../outputs/landing-art/` and `../persona/web/animals/`.
- No medical accuracy or proven learning-gain claims. Founding launch availability is explicitly unconfirmed.

## Payment integration — built, not activated

Reservation CTAs route to `checkout.html`. Server configuration controls whether payment is available. The price is INR 100, inclusive of applicable tax; no auto-debit mandate is created. Provider-captured payment, signature/ownership verification and durable recording are required before confirmation. Customer and team emails use a retrying SES outbox. Admin operations use Cognito on AWS. Refunds are manually initiated in Razorpay and verified by provider reference.

Use `dist/config.js` for the public API URL and Cognito settings only. Keys and signing secrets remain server-side. AWS accounts, DNS/SES verification and end-to-end deployed acceptance are still required. Current receipts are payment acknowledgements; tax-document compliance remains with the CA team. See PAYMENT-DECISIONS.md for approved policy and PAYMENTS-SETUP.md for operations.

## Campaign readiness still required

Configure live checkout and verified conversion recording; settle privacy/contact/support and refund policies; verify deployed product availability; choose the desired public audience/domain before sending Meta/Google traffic. Meta Pixel PageView tracking was added on 26 September 2026; no paid-conversion tracking is active. Do not count reservation-dialog opens as paid preorders.

## Comparison sources

- https://www.khanmigo.ai/
- https://www.embibe.com/in-en/artificial-intelligence-ai-in-education-articles/personalised-achievement-journey/

Descriptions checked 25 September 2026; no unsupported competitor feature-absence claims or price comparison.

## Brand and contact correction

The original Into3 SVG comes from https://into3.ai/assets/logo.svg. Purple tokens follow the existing onboarding source; imagery has matching purple edits. Footer links open existing official Privacy, Terms, Refund and cancellation information. The separate founding-offer page distinguishes reservation terms from existing subscription rules.

Set `whatsappNumber` in `dist/config.js` to the confirmed international business number, digits only, to activate the direct contact card and floating WhatsApp shortcut. The official site's placeholder is not used. Until the number is supplied, contact uses the published info@into3.ai address. Opening WhatsApp does not send a message automatically.

## September 25: shorter conversion path
Replaced the five-question carousel with the stronger RTAE question and a first-screen offer CTA. Full offer follows the RTAE explanation. Repeated bridge, standalone benefits, price preamble and closing sections were removed; additional scenarios and module details remain expandable. The comparison now helps parents assess habits and coaching/tuition support without blanket industry claims. Animal portraits use square contain frames. Payment and WhatsApp configuration requirements remain unchanged.

## PDF-led public variation
`introduction.html` is a second landing variation with the supplied two-pager's light treatment, original PRIA dock visual, RTAE mechanism and connected-module benefits. Both pages share the updated founding offer: Phase 1 capacity of 5,000 students, December 2026-January 2027 planned launch, no immediate access, included month, six discounted months and reservation credit. Capacity is not a live remaining-place count. No unspecified gifts, countdowns or completed reservations are implied. Checkout remains gated until gateway and reservation-specific terms are configured. The site audience is public; preserve it on future publication.

## Scientific-understanding variation
`scientific.html` adds the agreed Hinglish scientific-understanding hook, one original student/laptop sensing illustration, a pausable scan animation with reduced-motion support, and the sequence signals -> contextual assessment -> planner-approved personalisation. Signal categories distinguish observations, estimates and supported device inputs. Shared public founding offer and pre-launch disclosures remain. Hero generated with imagegen, conceptual rather than a real scan or benchmark result.

## Visual follow-through for variation three
Kept the hero intact. Added an illustrated signal gallery, three keyboard-accessible RTAE moment tabs with sequenced transitions, and visual module cards using the original PRIA dock, MetaLab and animal assets plus explanatory practice/revision/exam interfaces. Scroll reveals and hover interactions respect reduced-motion preferences. Desktop and 390/320px checks passed for all states, image loading and overflow.

## Learn-more journey and routing audit
All three hero areas and footers now link to `learn-more.html?from=<variation>`. The new page includes a demo-video coming-soon slot, learning-journey explanation, FAQs and demo requests. Return/offer links preserve the source using an allowlist. `learn-more.js` enables prepared WhatsApp requests when the user-confirmed number is configured; until then email is available and no fake WhatsApp destination is published. See ROUTING-AUDIT.md.

## Meta Pixel — 26 September 2026
User-authorized Pixel 1547708980458861 is installed once in each of the five HTML pages, with PageView and a no-JavaScript image fallback in the body. No advanced matching or custom student/health data is configured. This is browser Pixel integration, not server-side Conversions API. CAPI access token, verified payment events and browser/server event-ID deduplication remain backend work. No Purchase or Lead event is emitted by reservation dialogs. Meta Events Manager receipt has not been verified.
