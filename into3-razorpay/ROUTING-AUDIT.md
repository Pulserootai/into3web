# Landing-page link and CTA audit

Checked: 25 September 2026. Scope: original, introduction, scientific, learn-more and founding-offer pages.

| Area | Result |
|---|---|
| All reservation buttons across the three landing pages | Open the reservation-details dialog; Escape closes it. Payments remain disabled pending gateway and terms. |
| I want to know more | Added beside the hero offer path and in each footer; routes to learn-more.html with the source variation. |
| Return to overview / offer | Returns to the originating variation using an explicit allowlist; unknown source falls back to original. |
| Internal local links and same-page anchors | Checked by browser automation; no missing routes or anchor targets found. |
| Privacy, Terms, Refund policy links | Official HTTPS pages returned HTTP 200. |
| WhatsApp labels | Removed misleading active WhatsApp footer label while no number is configured. |
| Demo request | Prepared WhatsApp deep link with editable prefilled request; awaits user-confirmed business number. No message is sent automatically. |
| Future video | Honest coming-soon area with no fake play control. |
| Mobile layout | 390px and 320px checked, with no page overflow. |
| Browser errors | None observed during CTA journeys. |

Remaining external inputs: WhatsApp number; payment gateway; reservation-specific final terms; actual demo video. Email links route to the published info@into3.ai address; mailbox delivery was not tested. The WhatsApp destination cannot be verified until a real number is supplied.


WhatsApp update: user confirmed +918796989996. Contact, footer and floating links use this destination; both demo CTAs prepare the specific demo request. Link construction is browser-verified; no message sent and no claim of account availability verification.
