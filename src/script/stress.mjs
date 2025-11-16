import { Readable } from "node:stream";
import fs from "node:fs";
import assert from "node:assert";
import timers from "node:timers";

const path = process.argv[2];
const requestsPerSecond = process.argv[3];
const millisecondsPerRequest = (1 / requestsPerSecond) * 1000;
process.title = "reaction-memes-stress";
const devNull = fs.createWriteStream("/dev/null");
devNull.setMaxListeners(0);
let requests = 0;
while (true) {
  await timers.promises.setTimeout(millisecondsPerRequest);
  console.log(requests);
  requests++;
  fetch(`http://localhost:8080${path}`, {
    signal: AbortSignal.timeout(1000),
  }).then((res) => {
    requests--;
    Readable.fromWeb(res.body).pipe(devNull);
    assert.equal(res.status, 200);
  });
}
