// Thin fetch wrapper (cookie-based auth) + formatting helpers.

async function req(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401) throw { unauthorized: true };
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  me: () => req("/api/me"),
  config: () => req("/api/config"),
  login: (password) => req("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => req("/api/logout", { method: "POST" }),
  overview: () => req("/api/overview"),
  goal: () => req("/api/goal"),
  channel: (key) => req(`/api/channels/${key}`),
  entity: (key, id) => req(`/api/channels/${key}/entities/${encodeURIComponent(id)}`),
};

// ---- formatting ----
const int = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const money3 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 3 });

export function fmt(value, kind) {
  if (value == null || Number.isNaN(value)) return "—";
  switch (kind) {
    case "money": return money.format(value);
    case "money2": return money2.format(value);
    case "money3": return money3.format(value);
    case "pct": return `${dec1.format(value)}%`;
    case "dec1": return dec1.format(value);
    case "dec2": return dec2.format(value);
    case "int": return int.format(value);
    default: return int.format(value);
  }
}

export function fmtMetric(key, value, metricMeta) {
  const m = (metricMeta && metricMeta[key]) || {};
  const text = fmt(value, m.fmt);
  if (m.unit === "€") return text; // currency already prefixed
  if (m.unit === "%") return text;
  if (m.unit === "★") return `${text} ★`;
  return text;
}

export function metricLabel(key, metricMeta) {
  return (metricMeta && metricMeta[key] && metricMeta[key].label) || key;
}

// Status from current vs prior (frontend mirror for deltas).
export function deltaInfo(cur, prior, label = "vs prior 4 wks") {
  if (prior == null || prior === 0) return { dir: "flat", text: "" };
  const pct = ((cur - prior) / prior) * 100;
  const dir = pct > 2 ? "up" : pct < -2 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "▬";
  return { dir, text: `${arrow} ${dec1.format(Math.abs(pct))}% ${label}` };
}

export function shortWeek(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IE", { day: "2-digit", month: "short" });
}
