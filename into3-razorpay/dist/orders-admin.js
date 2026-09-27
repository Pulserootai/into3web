(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    c = window.INTO3_CONFIG || {},
    local = ["localhost", "127.0.0.1"].includes(location.hostname),
    base = c.apiBaseUrl || (local ? location.origin : ""),
    auth = c.adminAuth || {};
  let token = sessionStorage.getItem("into3-admin-token"),
    orders = [],
    next = null,
    selected;
  const note = (s) => {
    $("status").textContent = s;
  };
  const b64 = (b) =>
    btoa(String.fromCharCode(...new Uint8Array(b)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  async function api(path, body) {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Request failed");
    return d;
  }
  async function load(append = false) {
    try {
      const data = await api(
        "/api/admin/orders?q=" + encodeURIComponent($("search").value) +
          (append && next ? "&cursor=" + encodeURIComponent(next) : ""),
      );
      orders = append ? [...orders, ...data.orders] : data.orders;
      next = data.nextCursor;
      $("desk").hidden = false;
      $("login").hidden = true;
      $("more").hidden = !next;
      $("orders").replaceChildren(
        ...orders.map((o) => {
          const row = document.createElement("tr");
          for (const text of [
            `${o.reference}\n${o.customer.name}\n${o.customer.email}`,
            o.status + (o.refundOverdue ? " · REFUND OVERDUE" : ""),
            o.paymentId || "Unpaid",
            o.refundStatus || "—",
          ]) {
            const td = document.createElement("td");
            td.textContent = text;
            row.append(td);
          }
          if (o.paymentId) {
            const b = document.createElement("button");
            b.textContent = "Verify refund";
            b.className = "secondary";
            b.onclick = () => {
              selected = o.reference;
              $("refund-dialog").showModal();
            };
            row.lastChild.append(b);
          }
          return row;
        }),
      );
      note(`${orders.length} orders loaded. Customer data is confidential.`);
    } catch (e) {
      note(e.message);
    }
  }
  $("login").onclick = async () => {
    if (!auth.domain || !auth.clientId) {
      note("Administrator sign-in is not configured yet.");
      return;
    }
    const verifier = b64(crypto.getRandomValues(new Uint8Array(32))),
      state = b64(crypto.getRandomValues(new Uint8Array(24))),
      challenge = b64(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(verifier),
        ),
      );
    sessionStorage.setItem("into3-pkce", JSON.stringify({ verifier, state }));
    const params = new URLSearchParams({
      response_type: "code",
      client_id: auth.clientId,
      redirect_uri: location.origin + location.pathname,
      scope: "openid email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    location.assign(auth.domain + "/oauth2/authorize?" + params);
  };
  async function callback() {
    const p = new URLSearchParams(location.search);
    if (!p.has("code")) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem("into3-pkce"));
      if (!stored || stored.state !== p.get("state"))
        throw new Error("Sign-in state mismatch.");
      sessionStorage.removeItem("into3-pkce");
      history.replaceState(null, "", location.pathname);
      const r = await fetch(auth.domain + "/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: auth.clientId,
          code: p.get("code"),
          redirect_uri: location.origin + location.pathname,
          code_verifier: stored.verifier,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.access_token) throw new Error("Sign-in failed.");
      token = data.access_token;
      sessionStorage.setItem("into3-admin-token", token);
    } catch (e) {
      note(e.message);
    }
  }
  $("logout").onclick = () => {
    sessionStorage.removeItem("into3-admin-token");
    token = null;
    $("desk").hidden = true;
    $("login").hidden = false;
    if (auth.domain && auth.clientId)
      location.assign(
        auth.domain +
          "/logout?" +
          new URLSearchParams({
            client_id: auth.clientId,
            logout_uri: location.origin + location.pathname,
          }),
      );
  };
  if (local) {
    $("local").hidden = false;
    $("local-login").onclick = () => {
      token = $("local-token").value;
      $("local-token").value = "";
      load();
    };
  }
  $("load").onclick = () => load();
  $("more").onclick = () => load(true);
  $("close").onclick = () => $("refund-dialog").close();
  $("refund-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/refund", {
        reference: selected,
        refundId: $("refund-id").value,
      });
      $("refund-dialog").close();
      await load();
    } catch (err) {
      note(err.message);
    }
  };
  $("missed").onclick = async () => {
    if (
      prompt(
        "Type LAUNCH_MISSED only if the January launch deadline passed without launch. This queues eligible refunds for manual processing.",
      ) !== "LAUNCH_MISSED"
    )
      return;
    try {
      const r = await api("/api/admin/missed-launch", {
        confirm: "LAUNCH_MISSED",
      });
      await load();
      note(`${r.count} refunds queued for manual processing.`);
    } catch (e) {
      note(e.message);
    }
  };
  $("export").onclick = () => {
    const escape = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      ["Reference", "Name", "Email", "Phone", "Status", "Payment", "Refund"],
      ...orders.map((o) => [
        o.reference,
        o.customer.name,
        o.customer.email,
        o.customer.phone,
        o.status,
        o.paymentId,
        o.refundStatus,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((r) => r.map(escape).join(",")).join("\r\n")], {
        type: "text/csv",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "into3-reservations.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  callback().then(() => {
    if (token) load();
  });
})();
