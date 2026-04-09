alter table public."Users"
  add column if not exists "prep101TopUpCredits" integer not null default 0;

comment on column public."Users"."prep101TopUpCredits"
  is 'Remaining one-time Prep101 top-up credits from single-guide and 3-pack purchases.';
