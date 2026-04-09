alter table public."Users"
  add column if not exists "reader101Credits" integer not null default 0,
  add column if not exists "reader101SessionIds" jsonb not null default '[]'::jsonb,
  add column if not exists "boldChoicesCredits" integer not null default 0,
  add column if not exists "boldChoicesSessionIds" jsonb not null default '[]'::jsonb;

comment on column public."Users"."reader101Credits"
  is 'Remaining one-time Reader101 guide credits from standalone/add-on purchases.';

comment on column public."Users"."reader101SessionIds"
  is 'Stripe Checkout session ids already credited toward Reader101 one-time purchases.';

comment on column public."Users"."boldChoicesCredits"
  is 'Remaining one-time Bold Choices credits from single-guide purchases.';

comment on column public."Users"."boldChoicesSessionIds"
  is 'Stripe Checkout session ids already credited toward Bold Choices one-time purchases.';
