import {
  createHmac,
  timingSafeEqual,
  randomUUID,
  createHash,
} from "node:crypto";
import meta from "./meta-capi.cjs";
export const AMOUNT = 10000,
  CURRENCY = "INR",
  TERMS = "founding-2026-09-26";
const deadline = Date.parse("2027-01-31T23:59:59+05:30");
export const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function signature(secret, value, supplied) {
  if (typeof supplied !== "string" || !/^[a-f0-9]{64}$/i.test(supplied))
    return false;
  const expected = createHmac("sha256", secret).update(value).digest();
  return timingSafeEqual(expected, Buffer.from(supplied, "hex"));
}
const digest = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
const publicOrder = (o) => ({
  reference: o.id,
  order_id: o.gatewayId,
  amount: AMOUNT,
  currency: CURRENCY,
  status: o.status,
  refundStatus: o.refundStatus || null,
  createdAt: o.createdAt,
  credit: 100,
  termsVersion: o.termsVersion,
});
function customer(input) {
  const c = {
    name: String(input.name || "").trim(),
    email: String(input.email || "")
      .trim()
      .toLowerCase(),
    phone: String(input.phone || "").replace(/[\s()-]/g, ""),
    grade: Number(input.grade),
    state: String(input.state || "").trim(),
  };
  if (
    c.name.length < 2 ||
    c.name.length > 100 ||
    c.email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(c.email) ||
    !/^\+?[1-9]\d{9,14}$/.test(c.phone) ||
    !Number.isInteger(c.grade) ||
    c.grade < 6 ||
    c.grade > 12 ||
    c.state.length < 2 ||
    c.state.length > 60
  )
    fail(400, "Enter valid parent contact details, state and class (6–12).");
  return c;
}
export class Reservations {
  constructor({ store, gateway, config, mailer, track = null, now = () => Date.now() }) {
    Object.assign(this, { store, gateway, config, mailer, track, now });
  }
  token(id) {
    return createHmac("sha256", this.config.tokenSecret)
      .update("reservation:" + id)
      .digest("hex");
  }
  async owned(id, token) {
    if (!signature(this.config.tokenSecret, "reservation:" + id, token))
      fail(401, "Invalid reservation access.");
    const o = (await this.store.read()).orders[id];
    if (!o) fail(404, "Reservation not found.");
    return o;
  }
  // Meta user_data for an order: checkout form details plus the browser
  // identifiers captured at checkout (reused for the later Purchase).
  metaUser(o) {
    const m = o.meta || {},
      name = meta.splitName(o.customer.name);
    return meta.userData({
      ip: m.ip,
      ua: m.ua,
      fbp: m.fbp,
      fbc: m.fbc,
      em: o.customer.email,
      ph: o.customer.phone,
      fn: name.fn,
      ln: name.ln,
      st: o.customer.state,
      country: "in",
      hashed: { external_id: m.vid },
    });
  }
  // event_id "ic_<idempotency key>" matches the browser InitiateCheckout, and
  // stays the same when the same checkout attempt is retried.
  async initiateCheckout(o) {
    if (!this.track) return;
    await this.track({
      event_name: "InitiateCheckout",
      event_id: "ic_" + o.key,
      event_source_url: o.meta?.url || this.config.site + "/checkout",
      user_data: this.metaUser(o),
      custom_data: {
        currency: CURRENCY,
        value: AMOUNT / 100,
        content_ids: ["founding-reservation"],
        content_type: "product",
        num_items: 1,
      },
    });
  }
  // Purchase outbox: settle() marks newly confirmed orders pending; this sends
  // them (event_id "purchase_<reference>", so resends deduplicate) and the
  // worker retries failures every minute.
  async sendPurchases(onlyId) {
    if (!this.track) return;
    const pending = Object.values((await this.store.read()).orders).filter(
      (o) => o.capi?.purchase === "pending" && (!onlyId || o.id === onlyId),
    );
    for (const o of pending) {
      const ok = await this.track({
        event_name: "Purchase",
        event_id: "purchase_" + o.id,
        event_time: Math.floor(o.paidAt / 1000),
        event_source_url: o.meta?.url || this.config.site + "/checkout",
        user_data: this.metaUser(o),
        custom_data: {
          currency: CURRENCY,
          value: AMOUNT / 100,
          content_ids: ["founding-reservation"],
          content_type: "product",
          num_items: 1,
          order_id: o.id,
        },
      });
      await this.store.transaction((d) => {
        const c = d.orders[o.id].capi;
        if (c.purchase !== "pending") return;
        c.attempts = (c.attempts || 0) + 1;
        if (ok) c.purchase = "sent";
        else if (c.attempts >= 10) c.purchase = "failed";
      });
    }
  }
  async create(input, key, metaContext = {}) {
    if (!this.config.enabled) fail(503, "Reservations are not open yet.");
    if (this.now() > deadline)
      fail(409, "This pre-launch reservation window has ended.");
    if (
      input.amount !== undefined &&
      (!Number.isInteger(input.amount) ||
        input.amount < 100 ||
        input.amount !== AMOUNT)
    )
      fail(400, "Reservation amount must be 10000 paise (₹100).");
    if (input.currency !== undefined && input.currency !== CURRENCY)
      fail(400, "Currency must be INR.");
    if (
      input.termsVersion !== TERMS ||
      input.acceptedTerms !== true ||
      input.isParent !== true
    )
      fail(400, "A parent or guardian must accept the reservation terms.");
    if (!/^[a-zA-Z0-9_-]{20,80}$/.test(key || ""))
      fail(400, "A valid idempotency key is required.");
    const c = customer(input),
      hash = digest(c),
      id = "I3-" + randomUUID(),
      now = this.now();
    const claim = await this.store.transaction((d) => {
      const mode = this.config.keyId.startsWith("rzp_live_") ? "live" : "test";
      if (d.mode && d.mode !== mode)
        fail(503, "Use a separate ledger for live and test payments.");
      d.mode = mode;
      const existing = Object.values(d.orders).find((o) => o.key === key);
      if (existing) {
        if (existing.customerHash !== hash)
          fail(409, "This checkout attempt belongs to different details.");
        if (existing.status === "creation_failed") {
          existing.status = "creating";
          return { order: existing, fresh: true };
        }
        return { order: existing, fresh: false };
      }
      if (
        Object.values(d.orders).filter((o) => o.status === "confirmed")
          .length >= 5000
      )
        fail(409, "Phase 1 reservations are full.");
      if (Object.keys(d.orders).length >= 20000)
        fail(503, "Reservations temporarily paused for reconciliation.");
      const o = {
        id,
        key,
        customer: c,
        customerHash: hash,
        status: "creating",
        createdAt: now,
        termsVersion: TERMS,
        emails: {},
        amount: AMOUNT,
        currency: CURRENCY,
        meta: metaContext,
      };
      d.orders[id] = o;
      return { order: o, fresh: true };
    });
    if (!claim.fresh) {
      if (!claim.order.gatewayId)
        fail(
          409,
          "This order is still being reconciled. Please retry shortly; do not pay twice.",
        );
      await this.initiateCheckout(claim.order);
      return {
        ...publicOrder(claim.order),
        accessToken: this.token(claim.order.id),
        key_id: this.config.keyId,
      };
    }
    const workId = claim.order.id;
    try {
      const remote = await this.gateway.orders.create({
        amount: AMOUNT,
        currency: CURRENCY,
        receipt: workId,
        partial_payment: false,
      });
      if (
        !remote.id ||
        remote.amount !== AMOUNT ||
        remote.currency !== CURRENCY
      )
        throw new Error("Unexpected provider order");
      const o = await this.store.transaction((d) => {
        const o = d.orders[workId];
        o.gatewayId = remote.id;
        o.status = "pending";
        return o;
      });
      await this.initiateCheckout(o);
      return {
        ...publicOrder(o),
        accessToken: this.token(workId),
        key_id: this.config.keyId,
      };
    } catch (e) {
      await this.store.transaction((d) => {
        d.orders[workId].status = [400, 401].includes(e.statusCode)
          ? "creation_failed"
          : "creation_uncertain";
      });
      fail(
        e.statusCode === 401 ? 401 : 502,
        "Payment provider could not create the order. Retry the same checkout shortly.",
      );
    }
  }
  async settle(id, p) {
    return this.store.transaction((d) => {
      const o = d.orders[id];
      if (!o) fail(404, "Unknown order.");
      if (
        p.order_id !== o.gatewayId ||
        p.amount !== AMOUNT ||
        p.currency !== CURRENCY
      )
        fail(400, "Payment details do not match this reservation.");
      if (p.status !== "captured" && p.status !== "refunded")
        return publicOrder(o);
      if (o.paymentId && o.paymentId !== p.id)
        fail(409, "A different payment is already recorded.");
      o.paymentId = p.id;
      if (o.paidAt) return publicOrder(o);
      if (p.status === "refunded") {
        o.status = "refund_due";
        o.refundStatus = "pending";
        o.cancelRequestedAt ??= this.now();
      }
      o.paidAt = this.now();
      const full =
        Object.values(d.orders).filter((x) => x.status === "confirmed")
          .length >= 5000;
      o.status =
        full || o.cancelRequestedAt || this.now() > deadline
          ? "refund_due"
          : "confirmed";
      o.refundReason = full
        ? "capacity"
        : o.cancelRequestedAt
          ? "cancelled"
          : this.now() > deadline
            ? "launch_deadline"
            : null;
      if (o.status === "refund_due") {
        o.refundStatus = "requested";
        o.refundRequestedAt = o.cancelRequestedAt || this.now();
      } else o.capi = { purchase: "pending", attempts: 0 };
      o.emails.customer = { state: "pending", attempts: 0 };
      o.emails.team = { state: "pending", attempts: 0 };
      d.audit.push({
        at: this.now(),
        action: "payment_captured",
        reference: id,
      });
      return publicOrder(o);
    });
  }
  async verify(body, token) {
    const {
      reference,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;
    if (
      !reference ||
      !/^order_[a-zA-Z0-9_]+$/.test(razorpay_order_id || "") ||
      !/^pay_[a-zA-Z0-9_]+$/.test(razorpay_payment_id || "") ||
      !razorpay_signature
    )
      fail(400, "Missing payment verification fields.");
    const o = await this.owned(reference, token);
    if (
      o.gatewayId !== razorpay_order_id ||
      !signature(
        this.config.keySecret,
        o.gatewayId + "|" + razorpay_payment_id,
        razorpay_signature,
      )
    )
      fail(400, "Payment signature mismatch.");
    const payment = await this.gateway.payments.fetch(razorpay_payment_id);
    const result = await this.settle(reference, payment);
    await this.sendPurchases(reference);
    return result;
  }
  async status(id, token) {
    const order = await this.owned(id, token);
    if (order.gatewayId && !order.paidAt) {
      const payments = await this.gateway.orders.fetchPayments(order.gatewayId);
      for (const payment of payments.items || []) {
        if (["captured", "refunded"].includes(payment.status)) {
          await this.settle(id, payment);
        }
      }
    }
    return publicOrder(await this.owned(id, token));
  }
  async cancel(id, token) {
    await this.owned(id, token);
    if (this.now() > deadline)
      fail(409, "Contact orders@into3.ai for post-deadline refund assistance.");
    return this.store.transaction((d) => {
      const o = d.orders[id];
      if (o.refundStatus === "processed") return publicOrder(o);
      if (!o.cancelRequestedAt) {
        o.cancelRequestedAt = this.now();
        o.refundRequestedAt = this.now();
        o.refundStatus = o.paidAt ? "requested" : "awaiting_payment_check";
        o.status = o.paidAt ? "refund_due" : "cancel_requested";
        o.emails.cancellation = { state: "pending", attempts: 0 };
        o.emails.cancellationTeam = { state: "pending", attempts: 0 };
        d.audit.push({
          at: this.now(),
          action: "cancel_requested",
          reference: id,
        });
      }
      return publicOrder(o);
    });
  }
  async webhook(raw, sig) {
    if (
      !this.config.webhookSecret ||
      !signature(this.config.webhookSecret, raw, sig)
    )
      fail(400, "Invalid webhook signature.");
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      fail(400, "Invalid webhook.");
    }
    const p = event.payload?.payment?.entity;
    const refund = event.payload?.refund?.entity;
    const d = await this.store.read();
    if (p) {
      const o = Object.values(d.orders).find((x) => x.gatewayId === p.order_id);
      if (o && ["payment.captured", "order.paid"].includes(event.event))
        await this.settle(o.id, await this.gateway.payments.fetch(p.id));
    }
    if (refund && ["refund.processed", "refund.failed"].includes(event.event)) {
      const o = Object.values(d.orders).find(
        (x) => x.paymentId === refund.payment_id,
      );
      if (o) await this.recordRefund(o.id, refund.id, "webhook");
    }
    return { received: true };
  }
  async recordRefund(id, refundId, actor) {
    if (!/^rfnd_[a-zA-Z0-9]+$/.test(refundId || ""))
      fail(400, "Enter a Razorpay refund reference.");
    const r = await this.gateway.refunds.fetch(refundId);
    return this.store.transaction((d) => {
      const o = d.orders[id];
      if (!o || !o.paymentId) fail(404, "Paid reservation not found.");
      if (r.payment_id !== o.paymentId || r.amount !== AMOUNT)
        fail(400, "Refund must match this payment and the full ₹100.");
      o.refundId = r.id;
      o.refundStatus = r.status;
      if (r.status === "processed") {
        o.status = "refunded";
        o.emails.refund ??= { state: "pending", attempts: 0 };
      }
      d.audit.push({
        at: this.now(),
        action: "refund_verified",
        reference: id,
        actor,
      });
      return publicOrder(o);
    });
  }
  async list() {
    const d = await this.store.read();
    return Object.values(d.orders).map((o) => ({
      ...publicOrder(o),
      customer: o.customer,
      paymentId: o.paymentId,
      refundId: o.refundId,
      cancelRequestedAt: o.cancelRequestedAt,
      refundOverdue: Boolean(
        o.refundRequestedAt &&
        !["processed", "pending"].includes(o.refundStatus) &&
        this.now() - o.refundRequestedAt > 86400000,
      ),
      emails: o.emails,
    }));
  }
  async missedLaunch(actor) {
    if (this.now() <= deadline)
      fail(409, "The launch deadline has not passed.");
    return this.store.transaction((d) => {
      let count = 0;
      for (const o of Object.values(d.orders)) {
        if (o.status === "confirmed") {
          o.status = "refund_due";
          o.refundStatus = "requested";
          o.refundRequestedAt = this.now();
          o.refundReason = "missed_launch";
          o.emails.missedLaunch = { state: "pending", attempts: 0 };
          count++;
        }
      }
      d.audit.push({
        at: this.now(),
        actor,
        action: "missed_launch_refunds",
        count,
      });
      return { count };
    });
  }
  async work() {
    try {
      await this.sendPurchases();
    } catch {
      console.error("Meta Purchase outbox failed");
    }
    const orders = Object.values((await this.store.read()).orders);
    for (const o of orders
      .filter(
        (x) =>
          !x.paidAt ||
          ["requested", "pending", "failed"].includes(x.refundStatus),
      )
      .sort((a, b) => (a.lastChecked || 0) - (b.lastChecked || 0))
      .slice(0, 20)) {
      try {
        if (!o.gatewayId) {
          if (o.status === "creation_failed") continue;
          const r = await this.gateway.orders.all({ receipt: o.id, count: 2 });
          if (
            r.items?.length === 1 &&
            r.items[0].amount === AMOUNT &&
            r.items[0].currency === CURRENCY
          )
            await this.store.transaction((d) => {
              d.orders[o.id].gatewayId = r.items[0].id;
              d.orders[o.id].status = d.orders[o.id].cancelRequestedAt
                ? "cancel_requested"
                : "pending";
            });
        } else {
          const r = await this.gateway.orders.fetchPayments(o.gatewayId);
          for (const p of r.items || [])
            if (["captured", "refunded"].includes(p.status)) {
              await this.settle(o.id, p);
              if (p.amount_refunded === AMOUNT) {
                const rr = await this.gateway.payments.fetchMultipleRefund(
                  o.paymentId || p.id,
                  { count: 10 },
                );
                const full = rr.items?.find((x) => x.amount === AMOUNT);
                if (full) await this.recordRefund(o.id, full.id, "reconcile");
              }
            }
        }
      } catch {
        console.error("Reconciliation failed", o.id);
      } finally {
        await this.store.transaction((d) => {
          d.orders[o.id].lastChecked = this.now();
        });
      }
    }
    if (!this.mailer) return;
    for (let i = 0; i < 20; i++) {
      const lease = randomUUID();
      const item = await this.store.transaction((d) => {
        for (const o of Object.values(d.orders))
          for (const [kind, e] of Object.entries(o.emails)) {
            if (
              e.state === "sent" ||
              (e.leaseUntil || 0) > this.now() ||
              (e.nextAttempt || 0) > this.now()
            )
              continue;
            e.lease = lease;
            e.leaseUntil = this.now() + 120000;
            e.attempts++;
            return { order: o, kind };
          }
        return null;
      });
      if (!item) break;
      try {
        await this.mailer(item.order, item.kind, this.token(item.order.id));
        await this.store.transaction((d) => {
          const e = d.orders[item.order.id].emails[item.kind];
          if (e.lease === lease) {
            e.state = "sent";
            e.sentAt = this.now();
          }
        });
      } catch {
        await this.store.transaction((d) => {
          const e = d.orders[item.order.id].emails[item.kind];
          if (e.lease === lease) {
            e.state = "pending";
            e.leaseUntil = 0;
            e.nextAttempt =
              this.now() +
              Math.min(3600000, 30000 * 2 ** Math.min(e.attempts, 7));
          }
        });
      }
    }
  }
}
