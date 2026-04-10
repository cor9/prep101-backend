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
  return `${PREP_ROOT}/auth-bridge?redirect=${encodeURIComponent(redirectUrl)}`;
}

export function buildPrepAuthCallbackUrl(token, redirect = `${PREP_ROOT}/dashboard`) {
  const url = new URL(`${PREP_ROOT}/auth-callback`);
  if (token) url.searchParams.set('token', token);
  if (redirect) url.searchParams.set('redirect', redirect);
  return url.toString();
}

export function buildPrepOnboardingUrl({
  token,
  next = `${PREP_ROOT}/dashboard`,
} = {}) {
  const onboarding = new URL(`${PREP_ROOT}/onboarding`);
  if (next) onboarding.searchParams.set('next', next);
  return buildPrepAuthCallbackUrl(token, onboarding.toString());
}

export function buildPrepSelectActorUrl({
  token,
  next = `${PREP_ROOT}/dashboard`,
} = {}) {
  const selectActor = new URL(`${PREP_ROOT}/select-actor`);
  if (next) selectActor.searchParams.set('next', next);
  return buildPrepAuthCallbackUrl(token, selectActor.toString());
}

export function buildBoldChoicesUrl({
  token,
  redirect = '/generate',
  useBridge = false,
} = {}) {
  const callback = new URL(`${BOLD_ROOT}/auth-callback`);
  if (redirect) callback.searchParams.set('redirect', redirect);
  if (token) callback.searchParams.set('token', token);
  if (token) return callback.toString();
  if (useBridge) return buildPrepAuthBridgeUrl(callback.toString());
  return resolveProductUrl(BOLD_ROOT, redirect, `${BOLD_ROOT}/generate`);
}

export function buildReader101Url({
  token,
  redirect = `${READER_ROOT}/`,
  useBridge = false,
} = {}) {
  const callback = new URL(`${READER_ROOT}/auth-callback.html`);
  if (redirect) callback.searchParams.set('redirect', redirect);
  if (token) callback.searchParams.set('token', token);
  if (token) return callback.toString();
  if (useBridge) return buildPrepAuthBridgeUrl(callback.toString());
  return resolveProductUrl(READER_ROOT, redirect, `${READER_ROOT}/`);
}

export function buildReaderLogoutUrl(next = `${PREP_ROOT}/`) {
  return `${READER_ROOT}/logout.html?next=${encodeURIComponent(next)}`;
}
