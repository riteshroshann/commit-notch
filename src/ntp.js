// Minimal SNTP client. time.cloudflare.com is stratum 1-3, traced to atomic references.
const dgram = require("node:dgram");

const NTP_EPOCH = 2208988800; // seconds between 1900 and 1970

/** @param {Buffer} buf @param {number} at */
function readStamp(buf, at) {
  const sec = buf.readUInt32BE(at) - NTP_EPOCH;
  const frac = buf.readUInt32BE(at + 4) / 2 ** 32;
  return (sec + frac) * 1000;
}

/**
 * Clock offset in ms (true time minus local time) and the server used.
 * @param {string} host
 * @returns {Promise<{ offset: number, rtt: number, host: string }>}
 */
function query(host = "time.cloudflare.com") {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    const packet = Buffer.alloc(48);
    packet[0] = 0x23; // LI 0, version 4, client mode
    const timer = setTimeout(() => {
      sock.close();
      reject(new Error(`no answer from ${host}`));
    }, 3000);
    let t0 = 0;
    sock.once("message", (msg) => {
      const t3 = Date.now();
      clearTimeout(timer);
      sock.close();
      const t1 = readStamp(msg, 32);
      const t2 = readStamp(msg, 40);
      resolve({ offset: (t1 - t0 + (t2 - t3)) / 2, rtt: t3 - t0 - (t2 - t1), host });
    });
    sock.once("error", (e) => {
      clearTimeout(timer);
      sock.close();
      reject(e);
    });
    t0 = Date.now();
    sock.send(packet, 123, host);
  });
}

/** Best of a few samples: lowest round trip wins. */
async function sync(host = "time.cloudflare.com") {
  const results = [];
  for (let i = 0; i < 4; i++) {
    try {
      results.push(await query(host));
    } catch {}
  }
  if (!results.length) throw new Error(`could not reach ${host}`);
  return results.reduce((a, b) => (b.rtt < a.rtt ? b : a));
}

module.exports = { sync };
