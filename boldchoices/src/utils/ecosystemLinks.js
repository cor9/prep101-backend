const PREP_ROOT = 'https://prep101.site';
const READER_ROOT = 'https://reader101.site';

export const ACCOUNT_LABEL = 'Child Actor 101 Account';

function resolveProductUrl(root, redirect, fallback) {
  if (!redirect) return fallback;
  if (/^https?:\/\//i.test(redirect)) return redirect;
  const normalizedPath = redirect.startsWith('/') ? redirect : `/${redirect}`;
  return `${root}${normalizedPath}`;
}

export function buildPrepAuthCallbackUrl(_token, redirect = `${PREP_ROOT}/dashboard`) {
  return resolveProductUrl(PREP_ROOT, redirect, `${PREP_ROOT}/dashboard`);
}

export function buildPrepOnboardingUrl({
  token: _token,
  next = 'https://boldchoices.site/generate',
} = {}) {
  const onboarding = new URL(`${PREP_ROOT}/onboarding`);
  if (next) onboarding.searchParams.set('next', next);
  return onboarding.toString();
}

export function buildPrepSelectActorUrl({
  token: _token,
  next = 'https://boldchoices.site/generate',
} = {}) {
  const selectActor = new URL(`${PREP_ROOT}/select-actor`);
  if (next) selectActor.searchParams.set('next', next);
  return selectActor.toString();
}

export function buildReader101Url({
  token: _token,
  redirect = `${READER_ROOT}/`,
} = {}) {
  return resolveProductUrl(READER_ROOT, redirect, `${READER_ROOT}/`);
}
