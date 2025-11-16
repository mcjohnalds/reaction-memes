import { Readable } from "node:stream";
import fs from "node:fs";
import assert from "node:assert";
import timers from "node:timers";

export async function stressTest({
  targetRequestsPerSecond,
  stressTestDuration,
  lagLimit,
  log,
  port,
}) {
  const targetDuration = (1 / targetRequestsPerSecond) * 1000;
  const devNullFile = await fs.promises.open("/dev/null", "a");
  const devNull = devNullFile.createWriteStream();
  devNull.setMaxListeners(0);
  let lag = 0;
  const durations = [];
  let lastNow;
  let drift = 0;
  let promises = [];
  while (stressTestDuration > 0) {
    const now = performance.now();
    if (lastNow) {
      const duration = now - lastNow;
      stressTestDuration -= duration;
      durations.push(duration);
      if (durations.length > 20) {
        durations.shift();
        const rate = Math.round((1 / average(durations)) * 1000);
        if (lag > lagLimit) {
          throw new Error("Lag limit exceeded");
        }
        if (log) {
          console.log(`lag=${lag} rate=${rate}`);
        }
      }
      drift += targetDuration - duration;
      if (drift > 0) {
        await timers.promises.setTimeout(drift);
      }
    }
    lastNow = now;
    lag++;
    const p = fetch(`http://localhost:${port}/search?query=foo`, {
      signal: AbortSignal.timeout(1000),
    }).then((res) => {
      lag--;
      Readable.fromWeb(res.body).pipe(devNull);
      assert.equal(res.status, 200);
    });
    promises.push(p);
  }
  await Promise.all(promises);
}

function average(xs) {
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  return sum / xs.length;
}
