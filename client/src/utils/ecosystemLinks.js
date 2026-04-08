const PREP_ROOT = 'https://prep101.site';
const BOLD_ROOT = 'https://boldchoices.site';
const READER_ROOT = 'https://reader101.site';

export const ACCOUNT_LABEL = 'Child Actor 101 Account';

export function buildPrepAuthBridgeUrl(redirectUrl) {
  return `${PREP_ROOT}/auth-bridge?redirect=${encodeURIComponent(redirectUrl)}`;
}

export function buildPrepAuthCallbackUrl(token, redirect = `${PREP_ROOT}/dashboard`) {
  const url = new URL(`${PREP_ROOT}/auth-callback`);
  if (token) url.searchParams.set('token', token);
  if (redirect) url.searchParams.set('redirect', redirect);
  return url.toString();
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
  return `${BOLD_ROOT}/`;
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
  return `${READER_ROOT}/`;
}
