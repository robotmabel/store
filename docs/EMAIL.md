# Order email

**A static site cannot send email.** There is no server behind GitHub Pages, and
no browser can send mail on its own. So an order reaches you one of three ways.

| | What sends the mail | What you do |
|---|---|---|
| **Shopify connected** | Shopify | Nothing — it sends the customer receipt and your merchant notification. Best answer. |
| **A form-to-email service** | That service | Paste one public key into `assets/js/config.js` |
| **Nothing connected** | Nobody | The confirmation screen says so and gives the customer a button to email it to you |

The third case is what shipped first, and it is why no notification arrived.
The confirmation screen also wrongly said *"we have emailed a copy"* — it had
not. That is fixed: the wording now follows what actually happened, including
naming the error if a send fails.

Check the live state at [`/setup.html`](../setup.html).

---

## Fastest fix — Web3Forms, about two minutes

No account, no backend, free at low volume.

1. Open <https://web3forms.com>
2. Type the address you want orders sent to. Press **Create Access Key**.
3. They email you a key. Paste it into `assets/js/config.js`:

```js
notify: {
  web3formsKey: "paste-the-key-here",
  toCustomer: true,        // also copies the customer on their order
}
```

4. Commit and push. Done — every order is emailed to you, with the full line
   items, totals, shipping address, PO number and any order notes.

## Alternatives

```js
notify: { formspreeId: "xdkogqyz" }                     // formspree.io
notify: { emailjs: { serviceId: "", templateId: "",
                     customerTemplateId: "",           // optional customer receipt
                     publicKey: "" } }                 // emailjs.com
notify: { endpoint: "https://api.example.com/orders" }  // your own function
```

The `endpoint` option POSTs `{ order, text }` — `order` is the full record,
`text` is a formatted plain-text version ready to drop into an email body.

## What gets sent

Reference, timestamp, every line with SKU and extended price, subtotal,
shipping, total, customer name / email / phone / organisation, full shipping
address, delivery method, payment method, PO number and order notes.

## Testing it

`scripts/flows.mjs` covers all three states with a stubbed provider: that an
unconfigured store never claims to have sent mail, that a configured one
actually POSTs the order with the right payload, and that a failing provider
reports the error instead of hiding it. Run `node scripts/flows.mjs`.

## Note on keys

Everything in `assets/js/config.js` is **publishable** — these services are
designed for exactly this. A Stripe *secret* key or an SMTP password must never
go in this repository; GitHub Pages serves every file in it to the public.
