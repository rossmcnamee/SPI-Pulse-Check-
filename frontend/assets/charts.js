import { html, useState } from "./ui.js";
import { shortWeek, fmt } from "./api.js";

export const PALETTE = ["#0e7490", "#e08a00", "#7c4dff", "#2f9e6b", "#d6455c"];

// Multi-line chart. All lines share one y-scale, so only pass comparable series.
// lines: [{ label, points:[n], color, dashed?, fill? }]
export function LineChart({ weeks, lines, height = 260, valueKind = "int" }) {
  const W = 720, H = height;
  const padL = 52, padR = 16, padT = 16, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = weeks.length;
  const [hover, setHover] = useState(null);

  let lo = Infinity, hi = -Infinity;
  for (const ln of lines) for (const v of ln.points) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (lo === hi) { hi = lo + 1; }
  const pad = (hi - lo) * 0.12; lo = Math.max(0, lo - pad); hi = hi + pad;

  const x = (i) => padL + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v) => padT + plotH * (1 - (v - lo) / (hi - lo));

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => lo + (hi - lo) * t);
  const xticks = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  const path = (pts) => pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  // Map pointer position to the nearest data index (viewBox-space, so it works at any rendered width).
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width || n === 0) return;
    const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
    const px = ((clientX - r.left) / r.width) * W;
    let idx = n <= 1 ? 0 : Math.round(((px - padL) / plotW) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  };

  let tip = null;
  if (hover != null && hover < n) {
    const hx = x(hover);
    const single = lines.length === 1;
    const header = shortWeek(weeks[hover]);
    const rows = lines.map((ln) => ({
      color: ln.color,
      text: single ? fmt(ln.points[hover], valueKind) : `${ln.label}: ${fmt(ln.points[hover], valueKind)}`,
    }));
    const maxChars = Math.max(header.length, ...rows.map((r) => r.text.length));
    const boxW = Math.min(W - padL - padR, maxChars * 7.6 + 44);
    const rowH = 20;
    const boxH = 16 + rowH + rows.length * rowH;
    let boxX = hx > W * 0.55 ? hx - boxW - 10 : hx + 10;
    boxX = Math.max(padL, Math.min(W - padR - boxW, boxX));
    tip = { hx, rows, header, boxW, boxH, boxX, boxY: padT, rowH };
  }

  return html`
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" style=${{ width: "100%", height: "auto", display: "block" }} role="img"
           onMouseMove=${onMove} onMouseLeave=${() => setHover(null)}
           onTouchStart=${onMove} onTouchMove=${onMove} onTouchEnd=${() => setHover(null)}>
        ${gridYs.map((gv, i) => html`
          <g key=${"g" + i}>
            <line x1=${padL} x2=${W - padR} y1=${y(gv)} y2=${y(gv)} stroke="#eef2f6" stroke-width="1" />
            <text x=${padL - 8} y=${y(gv) + 4} text-anchor="end" font-size="12" fill="#9aa8b6">${fmt(gv, valueKind)}</text>
          </g>`)}
        ${xticks.map((ti) => html`
          <text key=${"x" + ti} x=${x(ti)} y=${H - 8} text-anchor="middle" font-size="12" fill="#9aa8b6">${shortWeek(weeks[ti])}</text>`)}
        ${lines.map((ln, li) => html`
          <g key=${"l" + li}>
            ${ln.fill ? html`<path d=${`${path(ln.points)} L${x(n - 1)},${y(lo)} L${x(0)},${y(lo)} Z`} fill=${ln.color} opacity="0.08" stroke="none" />` : null}
            <path d=${path(ln.points)} fill="none" stroke=${ln.color} stroke-width=${ln.dashed ? 2 : 2.4}
                  stroke-dasharray=${ln.dashed ? "6 5" : "0"} stroke-linejoin="round" stroke-linecap="round" />
          </g>`)}
        ${tip ? html`
          <g pointer-events="none">
            <line x1=${tip.hx} x2=${tip.hx} y1=${padT} y2=${padT + plotH} stroke="#c3ccd6" stroke-width="1" stroke-dasharray="3 3" />
            ${lines.map((ln, li) => html`<circle key=${"dot" + li} cx=${tip.hx} cy=${y(ln.points[hover])} r="3.5" fill="#fff" stroke=${ln.color} stroke-width="2" />`)}
            <g transform=${`translate(${tip.boxX},${tip.boxY})`}>
              <rect width=${tip.boxW} height=${tip.boxH} rx="7" fill="#1f2a37" opacity="0.96" />
              <text x="14" y="21" font-size="12" fill="#b6c2cf" font-weight="600">${tip.header}</text>
              ${tip.rows.map((r, ri) => html`
                <g key=${"row" + ri} transform=${`translate(14,${30 + ri * tip.rowH})`}>
                  <circle cx="5" cy="9" r="4" fill=${r.color} />
                  <text x="17" y="13" font-size="14" fill="#fff" font-weight="600">${r.text}</text>
                </g>`)}
            </g>
          </g>` : null}
      </svg>
      ${lines.length > 1 ? html`
        <div class="legend">
          ${lines.map((ln, i) => html`<span key=${i}><i class=${ln.dashed ? "dash" : ""} style=${ln.dashed ? {} : { background: ln.color }}></i>${ln.label}</span>`)}
        </div>` : null}
    </div>`;
}

// Small single-series chart for channel "small multiples".
export function MiniTrend({ weeks, points, color, label, valueKind }) {
  return html`
    <div class="panel" style=${{ padding: "14px" }}>
      <div class="section-title" style=${{ marginBottom: "6px" }}>${label}</div>
      <${LineChart} weeks=${weeks} valueKind=${valueKind || "int"}
        lines=${[{ label, points, color, fill: true }]} height=${230} />
    </div>`;
}
