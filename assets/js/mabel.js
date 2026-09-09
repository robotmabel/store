/* ============================================================================
   mabel.js — the MABEL configurator.

   Two builds (kit / assembled), a compute tier and a camera tier. The tier
   options are real SKUs from the catalogue, so their prices come from the same
   place as everywhere else and adding a configured robot to the bag adds the
   robot line plus whichever upgrade lines were chosen.
   ========================================================================== */
(() => {
  "use strict";
  const M = window.MABEL, esc = M.esc, h = M.href;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  if ((document.body.dataset.page || "") !== "mabel") return;

  // Included tier is priced into the robot; upgrades add their catalogue SKU.
  const COMPUTE = [
    { id: "jetson-orin-nano", label: "Jetson Orin Nano Super, 8 GB",
      note: "67 TOPS. The essential tier — enough for classical navigation and a compact policy.", included: true },
    { id: "jetson-orin-nx16", label: "Jetson Orin NX, 16 GB",
      note: "157 TOPS. Recommended: memory, not TOPS, is what binds a real robot.", included: false },
    { id: "jetson-thor", label: "Jetson AGX Thor, 128 GB",
      note: "2 070 TFLOPS. For running a vision-language-action model on board.", included: false },
  ];
  const CAMERA = [
    { id: "wrist-cam-720", label: "720p global-shutter wrists",
      note: "AR0144 at 60 fps. Included in the base build.", included: true, qty: 2 },
    { id: "wrist-cam-1200", label: "1200p global-shutter wrists",
      note: "Recommended. Wrist views carry the detail a policy learns from.", included: false, qty: 2 },
    { id: "realsense-d405", label: "RealSense D405 wrists",
      note: "Adds metric depth at 7–50 cm, at the cost of memory and cabling.", included: false, qty: 2 },
  ];

  let D, build = "mabel-kit", compute = COMPUTE[1].id, camera = CAMERA[1].id;

  const opt = (name, o, checked, price) => `
    <label class="pay-opt">
      <input type="radio" name="${name}" value="${esc(o.id)}"${checked ? " checked" : ""}>
      <span class="pi"><b>${esc(o.label)}</b><span>${esc(o.note)}</span></span>
      <span class="t-small" style="white-space:nowrap">${o.included ? "Included" : "+ " + M.money(price)}</span>
    </label>`;

  function extras() {
    const out = [];
    const c = COMPUTE.find(x => x.id === compute);
    if (c && !c.included) out.push({ id: c.id, qty: 1 });
    const k = CAMERA.find(x => x.id === camera);
    if (k && !k.included) out.push({ id: k.id, qty: k.qty || 1 });
    return out;
  }

  function total() {
    const base = D.byId[build].price;
    return base + extras().reduce((s, e) => s + D.byId[e.id].price * e.qty, 0);
  }

  function paint() {
    const p = D.byId[build];
    $("#cfgCompute").innerHTML = COMPUTE
      .map(o => opt("compute", o, o.id === compute, D.byId[o.id].price)).join("");
    $("#cfgCamera").innerHTML = CAMERA
      .map(o => opt("camera", o, o.id === camera, D.byId[o.id].price * (o.qty || 1))).join("");
    $$('input[name="build"]').forEach(i => { i.checked = i.value === build; });

    const rows = [[p.name, p.price]].concat(
      extras().map(e => [`${D.byId[e.id].name}${e.qty > 1 ? ` × ${e.qty}` : ""}`, D.byId[e.id].price * e.qty]));
    $("#cfgSummary").innerHTML = `
      <h3 class="t-head" style="margin:0 0 14px">Your configuration</h3>
      <ul class="sum">
        ${rows.map(([l, v]) => `<li><span>${esc(l)}</span><b>${M.money(v)}</b></li>`).join("")}
        <li class="total"><span>Total</span><b>${M.money(total())}</b></li>
      </ul>
      <p class="t-tiny" style="margin:-6px 0 14px">${esc(p.note || "")}</p>`;
    $("#cfgArt").src = h(p.image);
    $("#cfgArt").alt = p.name;
    // The product note above already covers assembly time; this line is only
    // about when it leaves us.
    $("#cfgLead").textContent = build === "mabel-kit"
      ? "Ships in 3–4 weeks."
      : "Built to order. Lead time 8–10 weeks from confirmation.";
  }

  async function boot() {
    try { D = await M.catalogue(); }
    catch (e) { return M.pages.fail($("#cfg"), e); }

    $("#cfg").addEventListener("change", e => {
      if (e.target.name === "build") build = e.target.value;
      else if (e.target.name === "compute") compute = e.target.value;
      else if (e.target.name === "camera") camera = e.target.value;
      paint();
    });
    $("#cfgAdd").addEventListener("click", () => {
      M.Bag.add(build, 1);
      extras().forEach(e => M.Bag.add(e.id, e.qty));
      M.toast(`${D.byId[build].name} added to your bag`);
      M.ui.openDrawer();
    });
    document.addEventListener("mabel:currency", paint);

    // the spec table, from the same product record the store uses
    $("#mabelSpecs").innerHTML = D.byId["mabel-assembled"].specs.map(g => `
      <div class="spec-g"><h3>${esc(g.group)}</h3>
        <table class="spec-t"><tbody>${g.rows.map(r =>
          `<tr><th scope="row">${esc(r.k)}</th><td>${esc(r.v)}</td></tr>`).join("")}</tbody></table></div>`).join("");

    // sub-assemblies you can buy on their own
    $("#subAssy").innerHTML = ["mabel-arm", "orca-hand-pair", "swerve-module", "openarm-structure"]
      .map(id => D.byId[id]).filter(Boolean).map(M.pages.cardHTML).join("");

    paint();
    M.reveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
