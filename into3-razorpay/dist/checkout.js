(() => {
  "use strict";
  const configured = window.INTO3_CONFIG?.apiBaseUrl || "";
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  const base = configured || (local ? location.origin : "");
  const $ = (id) => document.getElementById(id),
    message = (text) => {
      $("message").textContent = text;
    };
  let settings,
    order,
    busy = false;
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.get("reference") && fragment.get("token")) {
    order = {
      reference: fragment.get("reference"),
      accessToken: fragment.get("token"),
    };
    sessionStorage.setItem("into3-order", JSON.stringify(order));
    history.replaceState(null, "", location.pathname);
  } else
    try {
      order = JSON.parse(sessionStorage.getItem("into3-order"));
    } catch {}
  async function api(path, body, extra = {}) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(order ? { Authorization: "Bearer " + order.accessToken } : {}),
        ...extra,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Unable to complete request.");
    return data;
  }
  function show(o) {
    $("manage").hidden = false;
    $("order-status").textContent =
      `Reference: ${o.reference} · ${o.status.replaceAll("_", " ")}${o.refundStatus ? " · Refund: " + o.refundStatus : ""}`;
    if (o.status === "confirmed") {
      message(
        "Your founding-family reservation is confirmed. Your confirmation email will follow.",
      );
      $("checkout-form").hidden = true;
    } else if (
      ["refund_due", "refunded", "cancel_requested"].includes(o.status)
    ) {
      $("checkout-form").hidden = true;
      message(
        "Your cancellation/refund status is shown below. Contact orders@into3.ai with your reference for assistance.",
      );
    } else
      message(
        "Payment is not confirmed yet. Check status before trying another payment.",
      );
    $("cancel").disabled = [
      "refunded",
      "refund_due",
      "cancel_requested",
    ].includes(o.status);
  }
  async function refresh() {
    try {
      show(await api("/api/order-status", { reference: order.reference }));
    } catch (e) {
      message(e.message);
    }
  }
  let loading;
  function checkoutScript() {
    if (window.Razorpay) return Promise.resolve();
    return (loading ??= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = resolve;
      s.onerror = () => {
        loading = null;
        reject(new Error("Could not load secure checkout. Please retry."));
      };
      document.head.append(s);
    }));
  }
  $("checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !settings?.enabled) return;
    busy = true;
    $("pay").disabled = true;
    message("Preparing secure checkout…");
    let modalOpened = false;
    const release = () => {
      busy = false;
      $("pay").disabled = !settings?.enabled;
    };
    try {
      await checkoutScript();
      const values = Object.fromEntries(new FormData(e.target));
      const input = {
        ...values,
        grade: Number(values.grade),
        isParent: values.isParent === "on",
        acceptedTerms: values.acceptedTerms === "on",
        termsVersion: settings.termsVersion,
      };
      let attempt;
      try {
        attempt = JSON.parse(sessionStorage.getItem("into3-attempt"));
      } catch {}
      const fingerprint = JSON.stringify(input);
      if (attempt && attempt.fingerprint !== fingerprint && order)
        throw new Error(
          "This checkout has an existing order. Check its status or contact support before changing details.",
        );
      if (!attempt || attempt.fingerprint !== fingerprint) {
        attempt = { fingerprint, key: crypto.randomUUID() };
        sessionStorage.setItem("into3-attempt", JSON.stringify(attempt));
      }
      order = await api("/api/create-order", input, {
        "Idempotency-Key": attempt.key,
      });
      sessionStorage.setItem("into3-order", JSON.stringify(order));
      if (order.status !== "pending") {
        show(order);
        return;
      }
      const modal = new Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: "Into3",
        description: "Founding-family reservation · ₹100",
        prefill: { name: input.name, email: input.email, contact: input.phone },
        theme: { color: "#6331e7" },
        modal: {
          ondismiss: () => {
            message(
              "Checkout closed. If your account was debited, check payment status before retrying.",
            );
            $("manage").hidden = false;
            release();
          },
        },
        handler: async (result) => {
          message("Verifying payment…");
          try {
            show(
              await api("/api/verify-payment", {
                reference: order.reference,
                ...result,
              }),
            );
          } catch (err) {
            message(
              err.message + " Use Check payment status; do not pay again.",
            );
            $("manage").hidden = false;
          } finally {
            release();
          }
        },
      });
      modal.on("payment.failed", () => {
        message(
          "Payment failed. You may retry in the secure payment window, or close it and check status.",
        );
      });
      modal.open();
      modalOpened = true;
    } catch (err) {
      message(err.message);
    } finally {
      if (!modalOpened) release();
    }
  });
  $("refresh").addEventListener("click", refresh);
  $("cancel").addEventListener("click", async () => {
    if (
      !confirm(
        "Cancel your reservation and request a full refund of any confirmed ₹100 payment?",
      )
    )
      return;
    $("cancel").disabled = true;
    try {
      show(await api("/api/cancel-order", { reference: order.reference }));
    } catch (e) {
      message(e.message);
      $("cancel").disabled = false;
    }
  });
  if (!base) {
    $("availability").textContent =
      "Secure reservations are being connected. Payments are not open yet.";
    return;
  }
  api("/api/config")
    .then(async (c) => {
      settings = c;
      $("availability").textContent = c.enabled
        ? c.mode === "test"
          ? "TEST CHECKOUT — no real reservation is created."
          : "Reserve founding-family access securely with Razorpay."
        : "Reservations are not open yet.";
      $("pay").disabled = !c.enabled;
      if (order) await refresh();
    })
    .catch(() => {
      $("availability").textContent =
        "Checkout is temporarily unavailable. Please try again later.";
    });
})();
