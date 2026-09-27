# Payment implementation decisions

Confirmed by the owner, 26 September 2026. These are implementation inputs; payment processing is not yet implemented or enabled.

- Reservation payable total: INR 100 (10000 paise), inclusive of applicable tax. Do not add GST or processing fees above this total at checkout.
- Tax compliance, applicable rate, classification and receipt treatment: owner's CA team. Do not invent a tax rate or represent an unknown rate as zero/exempt. Keep the tax breakdown configurable and require it before issuing tax documents.
- Legal name transcribed and visually checked against both certificates: DEEPSCIENCE COGNITECH AI LABS PRIVATE LIMITED. Supersedes the earlier conversational spelling Cognitive.
- GST registration: Regular. GSTIN 09AAMCD7848L1ZS. Owner-confirmed correct address (26 September 2026): A-116, First Floor, Urbtech Trade Centre, Sector 132, Noida, Gautam Buddha Nagar, Uttar Pradesh 201304. Use A-116 in checkout business details and billing configuration. GST certificate currently prints U-116; CA team to reconcile the GST record before live tax documents are issued.
- Razorpay: owner confirms account activated. Test/live API keys have not been configured.
- Customer email sender and internal order notification recipient: orders@into3.ai. Domain verification and email delivery setup remain pending.
- Planned launch: December 2026-January 2027. Full reservation refund if launch misses 31 January 2027, processed manually by the team. Parents may also cancel before the launch deadline and receive a full INR 100 refund (owner confirmed 26 September 2026). Refunds are processed manually by the team. Owner confirmed: team initiates eligible cancellation refunds within 24 hours of the cancellation request. Bank/payment-provider processing time is additional; do not promise funds will arrive within 24 hours. Missed-launch refunds remain manually processed; do not infer an automatic bulk-refund schedule.
- Preserve the full INR 100 customer credit against the first paid subscription bill. CA team to determine accounting treatment without double-counting tax on the advance.
- No automatic subscription mandate is authorized by a reservation.
- Required build: checkout/order summary, server-created Razorpay orders, verified payment reconciliation, persistent reservations, customer/internal emails with retries, admin order/refund tracking, and AWS deployment setup.
- Current public frontend is hosted through Sites; no deployment in the owner's AWS account has been verified.

## Certificate inspection

Readable Desktop copies inspected on 26 September 2026; relevant first pages rendered and visually checked. This is document transcription, not live registry or digital-signature validation.

- GST certificate: registration effective 10 July 2026; GSTIN and principal address recorded above.
- Incorporation certificate: incorporated 10 June 2026; CIN U85500UW2026PTC254233.
- MCA mailing address: A-116, FIRST FLOOR, URBTECH TRADE CENTRE, SEC-132, Baraula, Dadri, Gautam Buddha Nagar, Uttar Pradesh 201304. Owner explicitly confirmed A-116 is correct. Preserve the source discrepancy with GST U-116 for CA reconciliation; do not alter either certificate.
- Source documents remain outside the public site. No director details, PAN or TAN need to be published for this checkout build.
