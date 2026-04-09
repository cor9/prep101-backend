const PREP_ROOT = 'https://prep101.site';
const BOLD_ROOT = 'https://boldchoices.site';
const READER_ROOT = 'https://reader101.site';

export const ACCOUNT_LABEL = 'Child Actor 101 Account';

function resolveProductUrl(root, redirect, fallback) {
  if (!redirect) return fallback;
  if (/^https?:\/\//i.test(redirect)) return redirect;
  const normalizedPath = redirect.startsWith('/') ? redirect : `/${redirect}`;
  return `${root}${normalizedPath}`;
}

export function buildPrepAuthBridgeUrl(redirectUrl) {
  return `${PREP_ROOT}/login?next=${encodeURIComponent(redirectUrl)}`;
}

export function buildPrepAuthCallbackUrl(_token, redirect = `${PREP_ROOT}/dashboard`) {
  return resolveProductUrl(PREP_ROOT, redirect, `${PREP_ROOT}/dashboard`);
}

export function buildPrepOnboardingUrl({
  token: _token,
  next = `${PREP_ROOT}/dashboard`,
} = {}) {
  const onboarding = new URL(`${PREP_ROOT}/onboarding`);
  if (next) onboarding.searchParams.set('next', next);
  return onboarding.toString();
}

export function buildPrepSelectActorUrl({
  token: _token,
  next = `${PREP_ROOT}/dashboard`,
} = {}) {
  const selectActor = new URL(`${PREP_ROOT}/select-actor`);
  if (next) selectActor.searchParams.set('next', next);
  return selectActor.toString();
}

export function buildBoldChoicesUrl({
  token: _token,
  redirect = '/generate',
  useBridge: _useBridge = false,
} = {}) {
  return resolveProductUrl(BOLD_ROOT, redirect, `${BOLD_ROOT}/generate`);
}

export function buildReader101Url({
  token: _token,
  redirect = `${READER_ROOT}/`,
  useBridge: _useBridge = false,
} = {}) {
  return resolveProductUrl(READER_ROOT, redirect, `${READER_ROOT}/`);
}
