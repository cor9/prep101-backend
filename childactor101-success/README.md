## childactor101-success

Single-purpose Vercel app for legacy Stripe success redirects.

Attach `childactor101.sbs` to this project and keep the Stripe Payment Links pointed at:

- `https://childactor101.sbs/app/stripe/success`

Behavior:

- `/app/stripe/success` redirects to `https://prep101.site/app/stripe/success`
- `/payment-success` redirects to `https://prep101.site/payment-success`
- all other routes render a small fallback page with a manual continue link
