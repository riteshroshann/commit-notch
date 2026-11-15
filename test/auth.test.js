import { expect, test } from "bun:test";
import { waitForToken } from "../src/auth.js";

/** Fake GitHub that answers a scripted sequence. @param {object[]} answers */
function github(answers) {
  const seen = [];
  const http = async (_url, init) => {
    seen.push(JSON.parse(init.body));
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return { json: async () => next };
  };
  return { http, seen };
}
const grant = { deviceCode: "dev", interval: 5, expiresIn: 900 };
const instant = { sleep: async () => {} };

test("waits through pending, then returns the token", async () => {
  const { http, seen } = github([
    { error: "authorization_pending" },
    { error: "authorization_pending" },
    { access_token: "gho_x" },
  ]);
  expect(await waitForToken("cid", grant, { http, ...instant })).toBe("gho_x");
  expect(seen).toHaveLength(3);
  expect(seen[0].grant_type).toBe("urn:ietf:params:oauth:grant-type:device_code");
});

test("slow_down stretches the interval by five seconds", async () => {
  const waits = [];
  const { http } = github([{ error: "slow_down", interval: 10 }, { access_token: "t" }]);
  await waitForToken("cid", grant, { http, sleep: async (ms) => void waits.push(ms) });
  expect(waits).toEqual([5000, 15000]);
});

test("a dropped request is retried, not fatal", async () => {
  const { http } = github([new Error("offline"), { access_token: "t" }]);
  expect(await waitForToken("cid", grant, { http, ...instant })).toBe("t");
});

test("declined and expired come back as named errors", async () => {
  const denied = github([{ error: "access_denied" }]);
  await expect(waitForToken("cid", grant, { http: denied.http, ...instant })).rejects.toMatchObject({ code: "denied" });
  const expired = github([{ error: "expired_token" }]);
  await expect(waitForToken("cid", grant, { http: expired.http, ...instant })).rejects.toMatchObject({
    code: "expired",
  });
});

test("the deadline ends polling even if GitHub keeps saying pending", async () => {
  let t = 0;
  const { http } = github(new Array(500).fill({ error: "authorization_pending" }));
  const opts = { http, sleep: async (ms) => void (t += ms), now: () => t };
  await expect(waitForToken("cid", { ...grant, expiresIn: 30 }, opts)).rejects.toMatchObject({ code: "expired" });
});

test("cancelling stops at the next tick", async () => {
  const ctl = new AbortController();
  ctl.abort();
  const { http } = github([{ access_token: "never" }]);
  await expect(waitForToken("cid", grant, { http, signal: ctl.signal, ...instant })).rejects.toMatchObject({
    code: "cancelled",
  });
});

test("a token that arrives after cancelling is thrown away", async () => {
  const ctl = new AbortController();
  const http = async () => {
    ctl.abort();
    return { json: async () => ({ access_token: "late" }) };
  };
  await expect(waitForToken("cid", grant, { http, signal: ctl.signal, ...instant })).rejects.toMatchObject({
    code: "cancelled",
  });
});
