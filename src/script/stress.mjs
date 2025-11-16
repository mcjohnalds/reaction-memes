import { Readable } from "node:stream";
import fs from "node:fs";
import assert from "node:assert";
import timers from "node:timers";

process.title = "reaction-memes-stress";
const path = process.argv[2];
const requestsPerSecond = process.argv[3];
const millisecondsPerRequest = (1 / requestsPerSecond) * 1000;
const devNullFile = await fs.promises.open("/dev/null", "a");
const devNull = devNullFile.createWriteStream();
devNull.setMaxListeners(0);
let requests = 0;
const times = [];
while (true) {
  times.push(performance.now());
  if (times.length > 20) {
    times.shift();
    const averageDuration = getAverageDuration();
    const rate = Math.floor((1 / averageDuration) * 1000);
    console.log(`lag=${requests} rate=${rate}`);
  }
  await timers.promises.setTimeout(millisecondsPerRequest);
  requests++;
  fetch(`http://localhost:8080${path}`, {
    signal: AbortSignal.timeout(1000),
  }).then((res) => {
    requests--;
    Readable.fromWeb(res.body).pipe(devNull);
    assert.equal(res.status, 200);
  });
}

function getAverageDuration() {
  let sum = 0;
  for (let i = 1; i < times.length; i++) {
    sum += times[i] - times[i - 1];
  }
  return sum / (times.length - 1);
}
