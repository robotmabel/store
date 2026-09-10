/* ============================================================================
   actuators.js — the actuator finder.

   Choosing a joint motor is a numbers problem: how much torque, at what
   voltage, through what kind of gearbox, on which bus, in what frame. The
   store grid cannot answer that, so this page filters on the machine-readable
   facets in tools/catalog.py and can show the whole field as one table.

   On missing data: a null facet means the figure is not published, not zero.
   Narrowing an axis sets those products aside and the page SAYS how many and
   why, with one click to bring them back. Silently dropping a product because
   a vendor does not publish a rated torque would be the wrong answer.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, esc = M.esc, h = M.href;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  if ((document.body.dataset.page || "") !== "actuators") return;

  const GEAR = { planetary: "Planetary", harmonic: "Harmonic (strain wave)",
                 none: "Direct drive", leadscrew: "Lead screw" };
  const num = v => (v === null || v === undefined ? null : Number(v));
  const fmt = (v, unit) => (v === null || v === undefined ? "—" : `${v}${unit || ""}`);

  let ALL = [], view = "grid";
  const state = {
    price: [0, Infinity], torque: [0, Infinity], frame: [0, Infinity],
    volts: new Set(), gear: new Set(), bus: new Set(),
    includeUnspecified: true, sort: "torque-desc", q: "",
  };

  // The torque axis uses rated where published and peak otherwise, because
  // mixing them silently would be worse than saying which one you are seeing.
  const torqueOf = p => {
    const f = p.facets || {};
    if (num(f.nom) !== null) return { v: num(f.nom), kind: "rated" };
    if (num(f.peak) !== null) return { v: num(f.peak), kind: "peak" };
    return { v: null, kind: null };
  };

  // Ranges and categories treat a missing figure differently, on purpose.
  // A number you cannot compare is a judgement call, so the "include
  // unpublished" switch governs it. A category is not: asking for TTL and being
  // shown a lead screw with no bus at all would just be wrong.
  function inRange(v, [lo, hi], allowUnspec) {
    if (lo === 0 && hi === Infinity) return true;      // axis not narrowed
    if (v === null) return allowUnspec;
    return v >= lo && v <= hi;
  }

  function matches(p, allowUnspec = state.includeUnspecified) {
    const f = p.facets || {};
    if (!inRange(p.price, state.price, allowUnspec)) return false;
    if (!inRange(torqueOf(p).v, state.torque, allowUnspec)) return false;
    if (!inRange(num(f.frame), state.frame, allowUnspec)) return false;
    for (const [key, set] of [["volts", state.volts], ["gear", state.gear], ["bus", state.bus]]) {
      if (!set.size) continue;
      const val = f[key];
      if (val === null || val === undefined) return false;
      if (!set.has(String(val))) return false;
    }
    if (state.q) {
      const hay = `${p.name} ${p.brand} ${p.tagline} ${p.sku}`.toLowerCase();
      if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.includes(t))) return false;
    }
    return true;
  }

  const SORTS = {
    "torque-desc": (a, b) => (torqueOf(b).v ?? -1) - (torqueOf(a).v ?? -1),
    "torque-asc": (a, b) => (torqueOf(a).v ?? Infinity) - (torqueOf(b).v ?? Infinity),
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    "name-asc": (a, b) => a.name.localeCompare(b.name),
  };

  function tableHTML(list) {
    return `<div class="tbl-wrap"><table class="cmp">
      <thead><tr>
        <th scope="col">Actuator</th><th scope="col">Torque</th><th scope="col">Peak</th>
        <th scope="col">Supply</th><th scope="col">Frame</th><th scope="col">Gearbox</th>
        <th scope="col">Bus</th><th scope="col">Reduction</th><th scope="col">Price</th>
      </tr></thead><tbody>
      ${list.map(p => {
        const f = p.facets || {}, t = torqueOf(p);
        return `<tr>
          <th scope="row"><a href="${h("product.html?id=" + encodeURIComponent(p.id))}">${esc(p.name)}</a>
            <span class="cmp-brand">${esc(p.brand)}</span></th>
          <td class="t-num">${t.v === null ? "—" : `${t.v} N·m${t.kind === "peak" ? " <span class=\"cmp-note\">peak</span>" : ""}`}</td>
          <td class="t-num">${fmt(num(f.peak), " N·m")}</td>
          <td class="t-num">${fmt(num(f.volts), " V")}</td>
          <td class="t-num">${fmt(num(f.frame), " mm")}</td>
          <td>${f.gear ? esc(GEAR[f.gear] || f.gear) : "—"}</td>
          <td>${f.bus ? esc(f.bus) : "—"}</td>
          <td>${f.ratio ? esc(f.ratio) : "—"}</td>
          <td class="t-num">${M.money(p.price)}</td>
        </tr>`;
      }).join("")}
      </tbody></table></div>`;
  }

  function render() {
    // NOT ALL.filter(matches): filter passes (item, index, array), so the index
    // would land in allowUnspec and every product after the first would be
    // treated as "include unpublished figures".
    let list = ALL.filter(p => matches(p));
    list = list.slice().sort(SORTS[state.sort]);

    // Exactly the products the "include unpublished" switch is keeping out.
    const setAside = state.includeUnspecified
      ? 0
      : ALL.filter(p => !matches(p, false) && matches(p, true)).length;

    $("#count").textContent = `${list.length} of ${ALL.length} actuators`;
    $("#results").innerHTML = list.length
      ? (view === "table" ? tableHTML(list) : `<div class="cards">${list.map(M.pages.cardHTML).join("")}</div>`)
      : `<div class="empty"><p class="t-head">Nothing matches those limits.</p>
           <p class="t-small">Widen a range, or turn unspecified figures back on.</p>
           <p style="margin-top:18px"><button class="btn btn-sm" id="resetEmpty">Reset filters</button></p></div>`;

    $("#unspecNote").innerHTML = setAside
      ? `<p class="t-small"><b>${setAside}</b> actuator${setAside === 1 ? " is" : "s are"} hidden
         because we do not publish every figure you are filtering on.
         <button class="btn-text" id="showUnspec">Include them</button></p>`
      : "";
    $("#showUnspec")?.addEventListener("click", () => {
      state.includeUnspecified = true; $("#unspec").checked = true; render();
    });
    $("#resetEmpty")?.addEventListener("click", reset);
  }

  function reset() {
    state.price = [0, Infinity]; state.torque = [0, Infinity]; state.frame = [0, Infinity];
    state.volts.clear(); state.gear.clear(); state.bus.clear();
    state.includeUnspecified = true; state.q = "";
    $$("#facets input[type=checkbox]").forEach(c => { c.checked = c.id === "unspec"; });
    $$("#facets input[type=number]").forEach(i => { i.value = ""; });
    $("#aq").value = "";
    render();
  }

  function rangeGroup(id, label, unit, hint) {
    return `<div class="filter-g">
      <h2>${esc(label)}</h2>
      ${hint ? `<p class="t-tiny" style="margin:-6px 0 10px">${hint}</p>` : ""}
      <div class="range-row">
        <label class="vh" for="${id}-min">Minimum ${esc(label)}</label>
        <input class="range-in" id="${id}-min" type="number" inputmode="decimal" placeholder="min" min="0">
        <span aria-hidden="true">–</span>
        <label class="vh" for="${id}-max">Maximum ${esc(label)}</label>
        <input class="range-in" id="${id}-max" type="number" inputmode="decimal" placeholder="max" min="0">
        <span class="t-tiny">${esc(unit)}</span>
      </div>
    </div>`;
  }

  function checkGroup(id, label, values, fmtv) {
    return `<div class="filter-g"><h2>${esc(label)}</h2><ul class="filter-list">
      ${values.map(v => {
        const n = ALL.filter(p => String(p.facets[id]) === String(v)).length;
        return `<li><label class="f-check">
          <input type="checkbox" data-facet="${esc(id)}" value="${esc(String(v))}">
          <span>${esc(fmtv ? fmtv(v) : String(v))}</span>
          <i style="margin-left:auto;font-style:normal;font-size:12px;color:var(--ink-3)">${n}</i>
        </label></li>`;
      }).join("")}
    </ul></div>`;
  }

  async function boot() {
    let d;
    try { d = await M.catalogue(); } catch (e) { return M.pages.fail($("#results"), e); }
    ALL = d.products.filter(p => p.category === "actuators");

    const uniq = k => [...new Set(ALL.map(p => p.facets[k]).filter(v => v !== null && v !== undefined))]
      .sort((a, b) => (typeof a === "number" ? a - b : String(a).localeCompare(String(b))));

    $("#facets").innerHTML =
      rangeGroup("torque", "Torque", "N·m", "Rated where published, otherwise peak.") +
      rangeGroup("price", "Price", M.currency) +
      rangeGroup("frame", "Frame size", "mm", "Outer diameter, or NEMA across flats.") +
      checkGroup("volts", "Supply voltage", uniq("volts"), v => `${v} V`) +
      checkGroup("gear", "Gearbox", uniq("gear"), v => GEAR[v] || v) +
      checkGroup("bus", "Interface", uniq("bus")) +
      `<div class="filter-g"><h2>Missing figures</h2>
        <label class="f-check"><input type="checkbox" id="unspec" checked>
          <span>Include actuators whose torque, price or frame we do not publish</span></label>
        </div>`;

    $("#facets").addEventListener("change", e => {
      const t = e.target;
      if (t.dataset.facet) {
        const set = state[t.dataset.facet];
        t.checked ? set.add(t.value) : set.delete(t.value);
      } else if (t.id === "unspec") {
        state.includeUnspecified = t.checked;
      }
      render();
    });
    $("#facets").addEventListener("input", e => {
      const id = e.target.id || "";
      const m = id.match(/^(torque|price|frame)-(min|max)$/);
      if (!m) return;
      const lo = parseFloat($(`#${m[1]}-min`).value);
      const hi = parseFloat($(`#${m[1]}-max`).value);
      state[m[1]] = [Number.isFinite(lo) ? lo : 0, Number.isFinite(hi) ? hi : Infinity];
      render();
    });

    let qt;
    $("#aq").addEventListener("input", () => {
      clearTimeout(qt);
      qt = setTimeout(() => { state.q = $("#aq").value.trim(); render(); }, 160);
    });
    $("#asort").addEventListener("change", e => { state.sort = e.target.value; render(); });
    $("#resetAll").addEventListener("click", reset);
    $$("[data-view]").forEach(b => b.addEventListener("click", () => {
      view = b.dataset.view;
      $$("[data-view]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      render();
    }));
    document.addEventListener("mabel:currency", render);

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
