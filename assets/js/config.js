/* ============================================================================
   config.js — the only file you edit to connect payments.
   Everything is blank on purpose. The store works with all of it blank: it
   falls back to a local bag and a quote request. Fill a section in and that
   path switches on by itself. Nothing secret belongs in this file — these are
   all publishable keys. Secret keys live on the server, never here.
   ========================================================================== */
window.MABEL_CONFIG = {

  /* ---- Shopify ---------------------------------------------------------
     Storefront API. Create a headless/custom app in your Shopify admin,
     grant it unauthenticated_read_product_listings + unauthenticated_write_checkouts,
     and paste the public Storefront access token below. When `domain` and
     `storefrontToken` are both set, Add to Bag creates a real Shopify cart and
     Checkout hands off to Shopify's hosted, PCI-compliant checkout.
     Import your catalogue first with dist/shopify_products.csv, then run
     `python3 tools/sync_ids.py` to write the variant IDs back into the site. */
  shopify: {
    domain: "",                    // e.g. "mabel-robotics.myshopify.com"
    storefrontToken: "",           // public Storefront API token
    apiVersion: "2025-07",
    customerAccountsUrl: "",       // e.g. "https://shopify.com/<shop-id>/account"
  },

  /* ---- Stripe ----------------------------------------------------------
     Two ways to use Stripe, in order of preference:
     1. checkoutEndpoint — your serverless function creates a Checkout Session
        from the bag and returns { url }. Handles multi-line bags and tax.
        A ready-to-deploy function is in api/create-checkout-session.js.
     2. paymentLinks — a per-product Stripe Payment Link, for single items.
     publishableKey is only needed if you later mount Stripe Elements. */
  stripe: {
    publishableKey: "",            // "pk_live_..." or "pk_test_..."
    checkoutEndpoint: "",          // e.g. "https://api.mabelrobotics.com/checkout"
    paymentLinks: {},              // { "damiao-dm8009p": "https://buy.stripe.com/..." }
  },

  /* ---- Commerce behaviour --------------------------------------------- */
  commerce: {
    currency: "USD",
    freeShippingOver: 500,         // USD
    flatShipping: 24,              // USD, Canada and continental US
    taxNote: "Taxes calculated at checkout",
    quoteEmail: "orders@mabelrobotics.com",
  },

  /* ---- Business ------------------------------------------------------- */
  business: {
    name: "MABEL Robotics",
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    email: "hello@mabelrobotics.com",
    support: "support@mabelrobotics.com",
    phone: "+1 (416) 555-0143",
    address: "Unit 4, 128 Sterling Road, Toronto, ON M6R 2B7",
    hours: "Monday to Friday, 9:00–17:00 ET",
  },
};
