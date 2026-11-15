// GitHub device flow: the person approves in their browser, we never see a password.
// https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
const SCOPES = "repo read:user";
const HEADERS = { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "commit-notch" };

/**
 * @param {string} clientId
 * @param {{ http?: typeof fetch, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ deviceCode: string, userCode: string, verificationUri: string, interval: number, expiresIn: number }>}
 */
async function requestCode(clientId, opts = {}) {
  const http = opts.http ?? fetch;
  const timeout = AbortSignal.timeout(15000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const res = await http("https://github.com/login/device/code", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ client_id: clientId, scope: SCOPES }),
    signal,
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error_description || j.error);
  return {
    deviceCode: j.device_code,
    userCode: j.user_code,
    verificationUri: j.verification_uri,
    interval: j.interval ?? 5,
    expiresIn: j.expires_in ?? 900,
  };
}

/** A sleep that ends early when the signal aborts. @param {number} ms @param {AbortSignal} [signal] */
function pause(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    const stop = () => {
      clearTimeout(t);
      resolve(undefined);
    };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

/**
 * Poll until the person approves, declines or the code expires.
 * Resolves with the token; rejects with an Error whose `code` is "expired", "denied", "cancelled" or "error".
 * @param {string} clientId
 * @param {{ deviceCode: string, interval: number, expiresIn: number }} grant
 * @param {{ signal?: AbortSignal, http?: typeof fetch, sleep?: (ms: number) => Promise<void>, now?: () => number }} [opts]
 */
async function waitForToken(clientId, grant, opts = {}) {
  const http = opts.http ?? fetch;
  const sleep = opts.sleep ?? ((ms) => pause(ms, opts.signal));
  const now = opts.now ?? Date.now;
  const deadline = now() + grant.expiresIn * 1000;
  let interval = grant.interval;
  const fail = (/** @type {string} */ code, /** @type {string} */ msg) => Object.assign(new Error(msg), { code });
  const cancelled = () => opts.signal?.aborted;

  while (now() < deadline) {
    await sleep(interval * 1000);
    if (cancelled()) throw fail("cancelled", "Sign in was cancelled");
    let j;
    try {
      const res = await http("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          client_id: clientId,
          device_code: grant.deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
        signal: opts.signal,
      });
      j = await res.json();
    } catch {
      if (cancelled()) throw fail("cancelled", "Sign in was cancelled");
      continue; // a dropped request is not a verdict; try again next tick
    }
    if (cancelled()) throw fail("cancelled", "Sign in was cancelled");
    if (j.access_token) return /** @type {string} */ (j.access_token);
    if (j.error === "authorization_pending") continue;
    if (j.error === "slow_down") {
      interval = (j.interval ?? interval) + 5;
      continue;
    }
    if (j.error === "expired_token") throw fail("expired", "The code expired");
    if (j.error === "access_denied") throw fail("denied", "Access was declined");
    throw fail("error", j.error_description || j.error || "GitHub sign in failed");
  }
  throw fail("expired", "The code expired");
}

module.exports = { requestCode, waitForToken, SCOPES };
