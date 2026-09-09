/* ============================================================================
   store.js — the shared runtime: catalogue, bag, nav, drawer, toast.
   Loaded by every page. Page-specific behaviour lives in pages.js and keys off
   document.body.dataset.page.
   ========================================================================== */
(() => {
  "use strict";

  const CFG = window.MABEL_CONFIG;
  const BAG_KEY = "mabel.bag.v1";
  const CUR_KEY = "mabel.currency.v1";

  /* ---------------------------------------------------------- storage ---- */
  // Every read and write is guarded: private windows, blocked site data and
  // preview contexts all throw here, and a store that white-screens because a
  // browser refused localStorage is not a store.
  const store = {
    get(k, fb) {
      try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); }
      catch { return fb; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  /* --------------------------------------------------------- catalogue --- */
  let DATA = null;
  let loading = null;

  // Works from / and from any sub-path, and from file:// during development.
  function dataURL() {
    const d = document.body.dataset.root || "";
    return `${d}assets/data/products.json`;
  }

  async function catalogue() {
    if (DATA) return DATA;
    if (loading) return loading;
    loading = fetch(dataURL(), { cache: "no-cache" })
      .then(r => { if (!r.ok) throw new Error(`products.json: HTTP ${r.status}`); return r.json(); })
      .then(j => {
        DATA = j;
        DATA.byId = Object.fromEntries(j.products.map(p => [p.id, p]));
        return DATA;
      })
      .catch(err => { loading = null; throw err; });
    return loading;
  }

  /* ---------------------------------------------------------- currency --- */
  let currency = store.get(CUR_KEY, "USD");
  const rate = () => (currency === "CAD" ? (DATA?.currency?.usdToCad || 1.37) : 1);

  function money(usd, opts = {}) {
    const v = usd * rate();
    // Always format in en-US: the en-CA locale renders CAD as a bare "$", which
    // is indistinguishable from USD on a store that shows both.
    const s = v.toLocaleString("en-US", {
      style: "currency", currency,
      minimumFractionDigits: v % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    });
    return opts.code ? `${s} ${currency}` : s;
  }

  function setCurrency(c) {
    currency = c === "CAD" ? "CAD" : "USD";
    store.set(CUR_KEY, currency);
    document.dispatchEvent(new CustomEvent("mabel:currency"));
  }

  /* --------------------------------------------------------------- bag --- */
  // [{ id, qty }] — ids only, so a price change is never stale in someone's bag.
  let bag = normalise(store.get(BAG_KEY, []));

  function normalise(v) {
    if (!Array.isArray(v)) return [];
    return v
      .filter(l => l && typeof l.id === "string")
      .map(l => ({ id: l.id, qty: Math.max(1, Math.min(99, parseInt(l.qty, 10) || 1)) }))
      .slice(0, 60);
  }

  const Bag = {
    all: () => bag.slice(),
    count: () => bag.reduce((n, l) => n + l.qty, 0),
    qty: id => bag.find(l => l.id === id)?.qty || 0,

    add(id, qty = 1) {
      const line = bag.find(l => l.id === id);
      if (line) line.qty = Math.min(99, line.qty + qty);
      else bag.push({ id, qty: Math.max(1, Math.min(99, qty)) });
      commit();
    },
    setQty(id, qty) {
      const n = Math.max(0, Math.min(99, parseInt(qty, 10) || 0));
      if (n === 0) return Bag.remove(id);
      const line = bag.find(l => l.id === id);
      if (line) { line.qty = n; commit(); }
    },
    remove(id) { bag = bag.filter(l => l.id !== id); commit(); },
    clear() { bag = []; commit(); },

    // Resolves ids against the catalogue. Anything no longer in the catalogue
    // is dropped rather than rendered as a broken line.
    async lines() {
      const d = await catalogue();
      return bag
        .map(l => ({ ...l, product: d.byId[l.id] }))
        .filter(l => l.product);
    },
    async totals() {
      const lines = await Bag.lines();
      const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
      const freeOver = CFG.commerce.freeShippingOver;
      const shipping = subtotal === 0 || subtotal >= freeOver ? 0 : CFG.commerce.flatShipping;
      return { lines, subtotal, shipping, total: subtotal + shipping, freeOver };
    },
  };

  function commit() {
    store.set(BAG_KEY, bag);
    paintCount();
    document.dispatchEvent(new CustomEvent("mabel:bag"));
  }

  function paintCount() {
    const n = Bag.count();
    document.querySelectorAll("[data-bag-count]").forEach(el => {
      el.textContent = n > 99 ? "99+" : String(n);
      el.classList.toggle("on", n > 0);
    });
    document.querySelectorAll("[data-bag-label]").forEach(el => {
      el.setAttribute("aria-label", n === 0 ? "Bag, empty" : `Bag, ${n} item${n === 1 ? "" : "s"}`);
    });
  }

  /* ----------------------------------------------------------- toast ----- */
  let toastEl, toastT;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add("on"));
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("on"), 2600);
  }

  /* ------------------------------------------------------- focus trap ---- */
  // Used by the bag drawer and the mobile menu. Without it, tabbing out of an
  // open drawer lands on the page behind, which is the classic overlay bug.
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  function trap(container, restoreTo) {
    function onKey(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      const items = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    let closeFn = () => {};
    function close() { closeFn(); }
    document.addEventListener("keydown", onKey);
    return {
      onClose(fn) { closeFn = fn; },
      release() {
        document.removeEventListener("keydown", onKey);
        if (restoreTo && document.contains(restoreTo)) restoreTo.focus();
      },
    };
  }

  function lockScroll(on) {
    if (on) {
      const sw = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      if (sw > 0) document.body.style.paddingRight = `${sw}px`;
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
  }

  /* ------------------------------------------------------------ util ----- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const root = () => document.body.dataset.root || "";
  const href = p => root() + p;

  function reveal() {
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach(el => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    els.forEach(el => io.observe(el));
  }

  window.MABEL = {
    CFG, store, catalogue, Bag, money, setCurrency, toast, esc, href, root,
    trap, lockScroll, reveal, paintCount,
    get currency() { return currency; },
  };
})();
