alter table public."Users"
  add column if not exists "prep101TopUpSessionIds" jsonb not null default '[]'::jsonb;

comment on column public."Users"."prep101TopUpSessionIds"
  is 'Stripe Checkout session ids already credited toward Prep101 one-time top-up purchases.';
