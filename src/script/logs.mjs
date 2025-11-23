import fs from "node:fs";
import * as readline from "node:readline";

const ignore = [
  "194.107.162.41",
  "2a09:bac3:311:355::55:59",
  "194.107.162.44",
  "2404:e80:8225:0:e979:d4f8:f101:a6af",
  "194.107.162.42",
  "2a09:bac2:310:355::55:35",
  "2a09:bac3:313:355::55:2b",
  "2a09:bac3:189:355::55:31",
  "2a02:26f7:e480:5702::f",
  "2404:e80:8225:0:e121:e551:20bd:7e1e",
  "2404:e80:8225:0:f14b:5aef:77d0:76da",
  "2404:e80:8225:0:e813:bc85:aa1c:c859",
  "13.237.156.34",
  "2404:e80:8225:0:2855:14b8:87f6:8cb1",
  "2404:e80:8225:0:3993:1c09:8929:c238",
  "2404:e80:8225:0:6c51:c9c6:183f:a2cf",
  "2404:e80:8225:0:572:611e:b30a:849f",
  "2a02:26f7:e488:5704:0:9000:0:e",
];

const stream = fs.createReadStream("data/logs.txt", { encoding: "utf8" });
const rl = readline.createInterface({ input: stream });
for await (const line of rl) {
  if (!line.includes('"url":"/search?')) {
    continue;
  }
  const json = JSON.parse(line);
  if (!json.ip || (ignore.includes(json.ip) && json.country === "AU")) {
    continue;
  }
  console.log(json);
}
