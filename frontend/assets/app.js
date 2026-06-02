import { html, useState, useEffect, React } from "./ui.js";
import { createRoot } from "react-dom/client";
import { api, fmt, fmtMetric, metricLabel, deltaInfo } from "./api.js";
import { LineChart, MiniTrend, PALETTE } from "./charts.js";

const STATUS_LABEL = { red: "Off track", orange: "On track", green: "Ahead" };
const num = (v) => (Number.isInteger(v) ? fmt(v, "int") : fmt(v, "dec1"));

// ---------- shared bits ----------
function Pill({ status }) {
  return html`<span class=${"pill " + status}>${STATUS_LABEL[status] || status}</span>`;
}

// Week-over-week direction indicator (last completed week vs the one before).
const TREND_ARROW = { up: "▲", down: "▼", flat: "▬" };
function Trend({ direction, changePct, label = "vs prev week" }) {
  const dir = direction || "flat";
  const pct = changePct == null ? "" : ` ${Math.abs(changePct).toFixed(1)}%`;
  return html`<span class=${"trend " + dir}>${TREND_ARROW[dir]}${pct}<span class="trend-lbl"> ${label}</span></span>`;
}

function useFetch(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ loading: true, data: null, error: null });
    fn().then((d) => live && setState({ loading: false, data: d, error: null }))
        .catch((e) => live && setState({ loading: false, data: null, error: e }));
    return () => { live = false; };
  }, deps);
  return state;
}

// ---------- goal banner ----------
function GoalBanner({ goal }) {
  if (!goal) return null;
  const pct = Math.min(100, goal.percent_to_goal);
  const gm = goal.gap_to_milestone;
  return html`
    <div class="banner">
      <div>
        <h1>North Star · New patients / week</h1>
        <div class="goaltext">Goal: 100 / week by December 2026 · both locations combined</div>
        <div class="bignum">${num(goal.new_patients)}<small>this week</small></div>
        <div class="progress"><span style=${{ width: pct + "%" }}></span></div>
      </div>
      <div class="banner-metrics">
        <div class="bm"><div class="k">This week's target</div><div class="v">${num(goal.milestone)}</div></div>
        <div class="bm"><div class="k">Gap to 100</div><div class="v">${num(goal.gap_to_goal)}</div></div>
        <div class="bm"><div class="k">Vs target</div><div class="v small">${gm >= 0 ? "+" : ""}${num(gm)}</div></div>
        <div class="bm"><div class="k">% to goal · status</div><div class="v small">${num(goal.percent_to_goal)}% <${Pill} status=${goal.status} /></div></div>
      </div>
    </div>`;
}

// ---------- nav ----------
function Nav({ channels, route }) {
  const isActive = (key) =>
    (key === "overview" && route.name === "overview") ||
    (route.name !== "overview" && route.channel === key);
  return html`
    <nav class="nav">
      <a href="#/" class=${isActive("overview") ? "active" : ""}>Overview</a>
      ${channels.map((c) => html`<a key=${c.key} href=${`#/c/${c.key}`} class=${isActive(c.key) ? "active" : ""}>${c.label}</a>`)}
    </nav>`;
}

// ---------- overview ----------
function OverviewPage({ metricMeta }) {
  const { loading, data, error } = useFetch(api.overview, []);
  if (loading) return html`<div class="loading">Loading pulse…</div>`;
  if (error) return html`<div class="loading">Could not load overview.</div>`;
  return html`
    <div class="grid" style=${{ marginTop: "16px" }}>
      <div class="panel">
        <div class="section-title">New patients / week — last 6 months vs milestone</div>
        <${LineChart} weeks=${data.weeks} valueKind="int"
          lines=${[
            { label: "New patients", points: data.northstar_trend, color: PALETTE[0], fill: true },
            { label: "Milestone target", points: data.milestone_trend, color: "#8a98a6", dashed: true },
          ]} height=${300} />
      </div>
      <div>
        <div class="section-title">Channel pulse</div>
        <div class="grid tiles">
          ${data.tiles.map((t) => html`<${Tile} key=${t.key} tile=${t} />`)}
        </div>
      </div>
    </div>`;
}

function Tile({ tile }) {
  const d = deltaInfo(tile.headline_value, tile.prior_value);
  return html`
    <a href=${`#/c/${tile.key}`} class=${"panel tile " + tile.status}>
      <div class="label">${tile.label}</div>
      <div class="value">${num(tile.headline_value)}</div>
      <div class="unit">${tile.headline_unit}</div>
      <div class=${"delta " + d.dir}>${d.text || "—"}</div>
    </a>`;
}

// ---------- channel ----------
function ChannelPage({ channel, metricMeta }) {
  const { loading, data, error } = useFetch(() => api.channel(channel), [channel]);
  if (loading) return html`<div class="loading">Loading ${channel}…</div>`;
  if (error) return html`<div class="loading">Could not load this channel.</div>`;
  const isEmpty = !data.weeks.length || !data.entities.length;
  return html`
    <div>
      <div class="page-head">
        <div><h2>${data.label}</h2><p>${data.description}</p></div>
        ${isEmpty ? null : html`<${Trend} direction=${data.direction} changePct=${data.change_pct} />`}
      </div>
      ${isEmpty ? html`
        <div class="panel" style=${{ textAlign: "center", padding: "44px 20px", color: "var(--muted)" }}>
          <div style=${{ fontSize: "32px", marginBottom: "10px" }}>📡</div>
          <div style=${{ fontWeight: 700, color: "var(--ink)", marginBottom: "6px" }}>No active campaigns right now</div>
          <div style=${{ fontSize: "14px", maxWidth: "440px", margin: "0 auto" }}>
            This channel is connected and live. As soon as activity is running, weekly data and trends will appear here automatically.
          </div>
        </div>` : html`
        ${channel === "gbp" ? html`<${ReviewsHighlight} entities=${data.entities} metricMeta=${metricMeta} />` : null}
        <div class="section-title" style=${{ marginTop: "18px" }}>Six-month trend</div>
        <div class="grid" style=${{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
          ${data.trends.map((t, i) => html`<${MiniTrend} key=${t.key} weeks=${data.weeks}
              points=${t.points} color=${PALETTE[i % PALETTE.length]} label=${t.label}
              valueKind=${(metricMeta[t.key] && metricMeta[t.key].fmt) || "int"} />`)}
        </div>
        ${channel === "funnel" ? html`<${FunnelExtras} extras=${data.extras} />` : null}
        <div class="section-title" style=${{ marginTop: "22px" }}>
          ${channel === "gbp" ? "Locations" : channel === "seo" ? "Sources" : "Campaigns"}
        </div>
        <div class="grid">
          ${data.entities.map((e) => html`<${EntityRow} key=${e.entity_id} channel=${channel} e=${e} primary=${data.primary_metric} metricMeta=${metricMeta} />`)}
        </div>`}
    </div>`;
}

function EntityRow({ channel, e, primary, metricMeta }) {
  const keys = Object.keys(e.metrics).filter((k) => k !== "rating_avg").slice(0, 4);
  const ordered = [primary, ...keys.filter((k) => k !== primary)].slice(0, 4);
  const stale = e.weeks_stale || 0;
  const staleLabel = stale === 1 ? "last active 1w ago" : `last active ${stale}w ago`;
  return html`
    <a href=${`#/c/${channel}/e/${encodeURIComponent(e.entity_id)}`} class="entity">
      <div>
        <div class="name">${e.entity_name} ${" "}${stale > 0
          ? html`<span class="paused">⏸ Paused · ${staleLabel}</span>`
          : html`<${Trend} direction=${e.direction} changePct=${e.change_pct} />`}</div>
        ${e.location ? html`<div class="loc">${e.location}</div>` : null}
        <div class="mini">
          ${ordered.map((k) => html`<span key=${k}>${metricLabel(k, metricMeta)}: <b>${fmtMetric(k, e.metrics[k], metricMeta)}</b></span>`)}
        </div>
      </div>
      <div class="chev">›</div>
    </a>`;
}

function ReviewsHighlight({ entities, metricMeta }) {
  return html`
    <div>
      <div class="section-title" style=${{ marginTop: "8px" }}>Reviews & rating — our biggest acquisition driver</div>
      <div class="reviewbig">
        ${entities.map((e) => {
          const rating = e.metrics.rating_avg || 0;
          const full = Math.round(rating);
          return html`
            <div class="reviewcard" key=${e.entity_id}>
              <div class="loc">${e.entity_name}</div>
              <div class="rating">${fmt(rating, "dec2")}</div>
              <div class="stars">${"★".repeat(full)}${"☆".repeat(5 - full)}</div>
              <div class="total">${fmt(e.metrics.reviews_total, "int")} total reviews · ${fmt(e.metrics.new_reviews, "int")} new this week</div>
            </div>`;
        })}
      </div>
    </div>`;
}

function FunnelExtras({ extras }) {
  if (!extras || !extras.pipeline) return null;
  const maxStage = Math.max(...extras.pipeline.map((p) => p.count));
  const maxTag = Math.max(...extras.injury_tags.map((t) => t.leads));
  return html`
    <div class="grid" style=${{ gridTemplateColumns: "1fr 1fr", marginTop: "20px" }}>
      <div class="panel">
        <div class="section-title">Pipeline stages (current)</div>
        ${extras.pipeline.map((p) => html`
          <div class="funnel-row" key=${p.stage}>
            <span class="muted">${p.stage}</span>
            <div class="funnel-bar" style=${{ width: (p.count / maxStage) * 100 + "%" }}></div>
            <b>${p.count}</b>
          </div>`)}
      </div>
      <div class="panel">
        <div class="section-title">Leads by injury type (this week)</div>
        ${extras.injury_tags.map((t) => html`
          <div class="tagbar" key=${t.tag}>
            <span class="muted">${t.tag}</span>
            <div class="b" style=${{ width: (t.leads / maxTag) * 100 + "%" }}></div>
            <b>${t.leads}</b>
          </div>`)}
      </div>
    </div>`;
}

// ---------- entity detail ----------
function EntityDetailPage({ channel, entity, metricMeta }) {
  const { loading, data, error } = useFetch(() => api.entity(channel, entity), [channel, entity]);
  if (loading) return html`<div class="loading">Loading…</div>`;
  if (error) return html`<div class="loading">Could not load this campaign.</div>`;
  return html`
    <div>
      <div class="breadcrumb"><a href=${`#/c/${channel}`}>‹ Back to ${data.channel}</a></div>
      <div class="page-head">
        <div><h2>${data.entity_name}</h2>${data.location ? html`<p>${data.location}</p>` : null}</div>
        <${Trend} direction=${data.direction} changePct=${data.change_pct} />
      </div>
      <div class="section-title">This week</div>
      <div class="grid metrics">
        ${Object.entries(data.current).map(([k, v]) => {
          const d = deltaInfo(v, data.prior[k], "vs prior wk");
          return html`
            <div class="metric" key=${k}>
              <div class="k">${metricLabel(k, metricMeta)}</div>
              <div class="v">${fmtMetric(k, v, metricMeta)}</div>
              <div class=${"delta " + d.dir} style=${{ fontSize: "12px", marginTop: "6px" }}>${d.text || "—"}</div>
            </div>`;
        })}
      </div>
      <div class="section-title" style=${{ marginTop: "22px" }}>Six-month trend</div>
      <div class="grid" style=${{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        ${data.trends.map((t, i) => html`<${MiniTrend} key=${t.key} weeks=${data.weeks}
            points=${t.points} color=${PALETTE[i % PALETTE.length]} label=${t.label}
            valueKind=${(metricMeta[t.key] && metricMeta[t.key].fmt) || "int"} />`)}
      </div>
    </div>`;
}

// ---------- login ----------
function Login({ onAuthed }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api.login(pw); onAuthed(); }
    catch { setErr("Incorrect password."); setBusy(false); }
  };
  return html`
    <div class="login">
      <form class="panel" onSubmit=${submit}>
        <div class="brandmark">Sports Physio Ireland</div>
        <div class="muted" style=${{ marginTop: "4px" }}>Marketing Pulse — team access</div>
        <input type="password" placeholder="Team password" value=${pw}
          onChange=${(e) => setPw(e.target.value)} autoFocus />
        <div class="err">${err}</div>
        <button type="submit" disabled=${busy}>${busy ? "Checking…" : "Enter dashboard"}</button>
      </form>
    </div>`;
}

// ---------- router + shell ----------
function parseHash() {
  const h = (location.hash || "#/").replace(/^#/, "");
  const parts = h.split("/").filter(Boolean); // ["c","google_ads","e","ga-brand"]
  if (parts[0] === "c" && parts[1] && parts[2] === "e" && parts[3])
    return { name: "entity", channel: parts[1], entity: decodeURIComponent(parts[3]) };
  if (parts[0] === "c" && parts[1]) return { name: "channel", channel: parts[1] };
  return { name: "overview" };
}

function Dashboard({ config }) {
  const [route, setRoute] = useState(parseHash());
  const [goal, setGoal] = useState(null);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { api.goal().then(setGoal).catch(() => {}); }, [route]);

  const mm = config.metric_meta;
  let page;
  if (route.name === "channel") page = html`<${ChannelPage} channel=${route.channel} metricMeta=${mm} />`;
  else if (route.name === "entity") page = html`<${EntityDetailPage} channel=${route.channel} entity=${route.entity} metricMeta=${mm} />`;
  else page = html`<${OverviewPage} metricMeta=${mm} />`;

  return html`
    <div class="app">
      <div class="topbar">
        <${GoalBanner} goal=${goal} />
        <${Nav} channels=${config.channels} route=${route} />
      </div>
      ${page}
    </div>`;
}

function App() {
  const [authed, setAuthed] = useState(null);
  const [config, setConfig] = useState(null);
  const load = () => api.me().then((r) => {
    setAuthed(r.authenticated);
    if (r.authenticated) api.config().then(setConfig);
  });
  useEffect(() => { load(); }, []);

  if (authed === null) return html`<div class="loading">Loading…</div>`;
  if (!authed) return html`<${Login} onAuthed=${() => load()} />`;
  if (!config) return html`<div class="loading">Loading…</div>`;
  return html`<${Dashboard} config=${config} />`;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
