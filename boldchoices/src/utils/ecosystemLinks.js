const PREP_ROOT = 'https://prep101.site';
const READER_ROOT = 'https://reader101.site';

export const ACCOUNT_LABEL = 'Child Actor 101 Account';

export function buildPrepAuthCallbackUrl(token, redirect = `${PREP_ROOT}/dashboard`) {
  const url = new URL(`${PREP_ROOT}/auth-callback`);
  if (token) url.searchParams.set('token', token);
  if (redirect) url.searchParams.set('redirect', redirect);
  return url.toString();
}

export function buildPrepOnboardingUrl({
  token,
  next = 'https://boldchoices.site/generate',
} = {}) {
  const onboarding = new URL(`${PREP_ROOT}/onboarding`);
  if (next) onboarding.searchParams.set('next', next);
  return buildPrepAuthCallbackUrl(token, onboarding.toString());
}

export function buildReader101Url({
  token,
  redirect = `${READER_ROOT}/`,
} = {}) {
  const callback = new URL(`${READER_ROOT}/auth-callback.html`);
  if (redirect) callback.searchParams.set('redirect', redirect);
  if (token) callback.searchParams.set('token', token);
  return token ? callback.toString() : `${READER_ROOT}/`;
}
