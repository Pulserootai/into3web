import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { Reservations, TERMS, signature } from "../service.js";
import { empty, FileStore, S3Store } from "../store.js";
import { dispatch } from "../api.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const input = {
  name: "Parent Example",
  email: "parent@example.test",
  phone: "+919876543210",
  grade: 6,
  state: "Uttar Pradesh",
  isParent: true,
  acceptedTerms: true,
  termsVersion: TERMS,
};
const config = {
  enabled: true,
  keyId: "rzp_test_fixture",
  keySecret: "fixture-secret-not-real",
  tokenSecret: "a".repeat(40),
  webhookSecret: "webhook-fixture",
  origin: "http://localhost:8801",
  adminToken: "b".repeat(40),
};
function setup() {
  let state = empty();
  const store = {
    read: async () => structuredClone(state),
    transaction: async (fn) => {
      const next = structuredClone(state);
      const result = fn(next);
      state = next;
      return structuredClone(result);
    },
  };
  let serial = 0;
  const payments = {};
  const gateway = {
    orders: {
      create: async (x) => ({ id: "order_" + ++serial, ...x }),
      fetchPayments: async (id) => ({
        items: Object.values(payments).filter((p) => p.order_id === id),
      }),
      all: async () => ({ items: [] }),
    },
    payments: {
      fetch: async (id) => payments[id],
      fetchMultipleRefund: async () => ({ items: [] }),
    },
    refunds: {
      fetch: async (id) => ({
        id,
        payment_id: "pay_test",
        amount: 10000,
        status: "processed",
      }),
    },
  };
  let time = Date.parse("2026-09-26T12:00:00Z");
  const s = new Reservations({
    store,
    gateway,
    config: { ...config },
    now: () => time,
  });
  return { s, store, gateway, payments, setTime: (n) => (time = n) };
}
async function create(s, key = "idempotency_fixture_key_001") {
  return s.create(input, key);
}
function paid(o, overrides = {}) {
  return {
    id: "pay_test",
    order_id: o.order_id,
    amount: 10000,
    currency: "INR",
    status: "captured",
    ...overrides,
  };
}
function signed(o) {
  return {
    reference: o.reference,
    razorpay_order_id: o.order_id,
    razorpay_payment_id: "pay_test",
    razorpay_signature: createHmac("sha256", config.keySecret)
      .update(o.order_id + "|pay_test")
      .digest("hex"),
  };
}
test("amount is server controlled and minimum enforced", async () => {
  const { s } = setup();
  for (const amount of [99, 100, 10001, "10000", 1.1])
    await assert.rejects(
      s.create({ ...input, amount }, "idempotency_fixture_key_001"),
      { status: 400 },
    );
  const o = await create(s);
  assert.equal(o.amount, 10000);
  assert.equal(o.currency, "INR");
});
test("parent, terms and class are validated", async () => {
  const { s } = setup();
  for (const patch of [
    { isParent: false },
    { acceptedTerms: false },
    { termsVersion: "old" },
    { grade: 5 },
    { email: "invalid" },
  ])
    await assert.rejects(
      s.create({ ...input, ...patch }, "idempotency_fixture_key_001"),
      { status: 400 },
    );
});
test("idempotent retry reuses one order; conflicting details rejected", async () => {
  const { s } = setup();
  const a = await create(s),
    b = await create(s);
  assert.equal(a.order_id, b.order_id);
  assert.equal(a.accessToken, b.accessToken);
  await assert.rejects(
    s.create(
      { ...input, email: "other@example.test" },
      "idempotency_fixture_key_001",
    ),
    { status: 409 },
  );
});
test("concurrent same-key requests cannot create two provider orders", async () => {
  const { s, store } = setup();
  const results = await Promise.allSettled([create(s), create(s)]);
  assert.equal(Object.keys((await store.read()).orders).length, 1);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});
test("forged and missing signatures never mark paid", async () => {
  const { s, store } = setup();
  const o = await create(s);
  await assert.rejects(
    s.verify(
      { ...signed(o), razorpay_signature: "0".repeat(64) },
      o.accessToken,
    ),
    { status: 400 },
  );
  await assert.rejects(s.verify({}, o.accessToken), { status: 400 });
  assert.equal((await store.read()).orders[o.reference].paidAt, undefined);
});
test("valid signature still requires captured payment and matching amount", async () => {
  const { s, payments } = setup();
  const o = await create(s);
  payments.pay_test = paid(o, { status: "authorized" });
  assert.equal((await s.verify(signed(o), o.accessToken)).status, "pending");
  payments.pay_test = paid(o, { amount: 100 });
  await assert.rejects(s.verify(signed(o), o.accessToken), { status: 400 });
  payments.pay_test = paid(o);
  assert.equal((await s.verify(signed(o), o.accessToken)).status, "confirmed");
});
test("reservation token prevents cross-customer access", async () => {
  const { s } = setup();
  const o = await create(s);
  await assert.rejects(s.status(o.reference, "0".repeat(64)), { status: 401 });
});
test("webhook validates raw bytes; duplicates do not duplicate notifications", async () => {
  const { s, payments, store } = setup();
  const o = await create(s);
  payments.pay_test = paid(o);
  const raw = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: payments.pay_test } },
  });
  const sig = createHmac("sha256", config.webhookSecret)
    .update(raw)
    .digest("hex");
  await assert.rejects(s.webhook(raw + " ", sig), { status: 400 });
  await s.webhook(raw, sig);
  await s.webhook(raw, sig);
  const order = (await store.read()).orders[o.reference];
  assert.equal(order.status, "confirmed");
  assert.equal(Object.keys(order.emails).length, 2);
  assert.equal((await store.read()).audit.length, 1);
});
test("cancel before delayed capture becomes refund due", async () => {
  const { s } = setup();
  const o = await create(s);
  await s.cancel(o.reference, o.accessToken);
  assert.equal((await s.settle(o.reference, paid(o))).status, "refund_due");
});
test("manual refund is verified with provider before recording", async () => {
  const { s, gateway } = setup();
  const o = await create(s);
  await s.settle(o.reference, paid(o));
  gateway.refunds.fetch = async () => ({
    id: "rfnd_test",
    payment_id: "pay_other",
    amount: 10000,
    status: "processed",
  });
  await assert.rejects(s.recordRefund(o.reference, "rfnd_test", "admin"), {
    status: 400,
  });
  gateway.refunds.fetch = async () => ({
    id: "rfnd_test",
    payment_id: "pay_test",
    amount: 10000,
    status: "processed",
  });
  assert.equal(
    (await s.recordRefund(o.reference, "rfnd_test", "admin")).status,
    "refunded",
  );
});
test("email outbox retries failures without duplicating successful delivery", async () => {
  const { s, setTime } = setup();
  const o = await create(s);
  await s.settle(o.reference, paid(o));
  const delivered = [];
  let first = true;
  s.mailer = async (o, k) => {
    if (first) {
      first = false;
      throw Error("SES unavailable");
    }
    delivered.push(k);
  };
  await s.work();
  setTime(Date.parse("2026-09-26T13:00:00Z"));
  await s.work();
  await s.work();
  assert.deepEqual(delivered.sort(), ["customer", "team"]);
});
test("reconciliation recovers a captured payment without callback", async () => {
  const { s, payments } = setup();
  const o = await create(s);
  payments.pay_test = paid(o);
  await s.work();
  assert.equal(
    (await s.status(o.reference, o.accessToken)).status,
    "confirmed",
  );
});
test("definite provider auth failure can retry same order after key fix", async () => {
  const { s, gateway } = setup();
  gateway.orders.create = async () => {
    throw { statusCode: 401 };
  };
  await assert.rejects(create(s), { status: 401 });
  gateway.orders.create = async (x) => ({ id: "order_fixed", ...x });
  assert.equal((await create(s)).order_id, "order_fixed");
});
test("full capacity rejects new orders and refunds a late concurrent capture", async () => {
  const { s, store } = setup();
  const o = await create(s);
  await store.transaction((d) => {
    for (let i = 0; i < 5000; i++)
      d.orders["full" + i] = { status: "confirmed" };
  });
  await assert.rejects(create(s, "idempotency_fixture_key_002"), {
    status: 409,
  });
  assert.equal((await s.settle(o.reference, paid(o))).status, "refund_due");
});
test("deadline blocks new reservations and queues missed-launch refunds only explicitly", async () => {
  const { s, setTime } = setup();
  const o = await create(s);
  await s.settle(o.reference, paid(o));
  await assert.rejects(s.missedLaunch("admin"), { status: 409 });
  setTime(Date.parse("2027-02-01T00:00:00+05:30"));
  await assert.rejects(create(s, "idempotency_fixture_key_002"), {
    status: 409,
  });
  assert.equal((await s.missedLaunch("admin")).count, 1);
});
test("API denies unauthenticated admin, wrong group, bad origin and malformed JSON", async () => {
  const { s } = setup();
  const rt = { service: s, config };
  for (const [req, status] of [
    [{ method: "GET", path: "/api/admin/orders" }, 401],
    [
      {
        method: "GET",
        path: "/api/admin/orders",
        claims: { sub: "x", "cognito:groups": ["students"] },
      },
      403,
    ],
    [
      {
        method: "GET",
        path: "/api/config",
        headers: { origin: "https://evil.test" },
      },
      403,
    ],
    [{ method: "POST", path: "/api/create-order", raw: "{" }, 400],
  ])
    assert.equal((await dispatch(rt, req)).status, status);
  assert.equal(
    (
      await dispatch(rt, {
        method: "GET",
        path: "/api/admin/orders",
        claims: { sub: "admin", "cognito:groups": ["admins"] },
      })
    ).status,
    200,
  );
});
test("constant-time signature validation rejects malformed hex", () => {
  for (const value of ["", null, "x".repeat(64), "0".repeat(63)])
    assert.equal(signature("key", "value", value), false);
});
test("local file store persists concurrent commits across restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "into3-"));
  try {
    const path = join(dir, "ledger.json"),
      s = new FileStore(path);
    await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        s.transaction((d) => {
          d.orders[i] = { id: i };
        }),
      ),
    );
    assert.equal(
      Object.keys(await new FileStore(path).read().then((d) => d.orders))
        .length,
      30,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});
test("S3 retries conditional write conflicts rather than overwriting", async () => {
  let writes = 0;
  const client = {
    send: async (cmd) => {
      if (cmd.constructor.name === "GetObjectCommand")
        return {
          ETag: "etag",
          Body: { transformToString: async () => JSON.stringify(empty()) },
        };
      assert.equal(cmd.input.IfMatch, "etag");
      if (++writes === 1) throw { $metadata: { httpStatusCode: 412 } };
      return {};
    },
  };
  const s = new S3Store("test", client);
  assert.equal(
    await s.transaction((d) => {
      d.orders.a = {};
      return "ok";
    }),
    "ok",
  );
  assert.equal(writes, 2);
});
