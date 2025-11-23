import fs from "node:fs";
import * as readline from "node:readline";
import assert from "node:assert/strict";

const ignoredAUIPs = [
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
  "194.107.162.39",
];
const ignoredAgents = [
  / UptimeRobot\//,
  /^okhttp\//,
  /^curl\//,
  /^Twitterbot\//,
  /^Python\//,
  /^python-requests\//,
  /^axios\//,
  /^Java\//,
  /^Go-http-client\//,
  /^node$/,
  /^EmailWolf/,
  /^Hello from Palo Alto Networks/,
  /^Googlebot-Image\//,
];
const urlGroups = [/^\/thumbnails\//, /^\/images\//, /^\/search\?/];
const staticFiles = await fs.promises.readdir("static");

function isAgentIgnored(agent) {
  for (const ia of ignoredAgents) {
    if (agent.match(ia)) {
      return true;
    }
  }
  return false;
}

const stream = fs.createReadStream("data/logs.txt", { encoding: "utf8" });
const rl = readline.createInterface({ input: stream });
const allLogs = [];
const logs = [];
for await (const line of rl) {
  if (!line.includes('"status":')) {
    continue;
  }
  const log = JSON.parse(line);
  allLogs.push(log);
  const isIPIgnored =
    !log.ip || (ignoredAUIPs.includes(log.ip) && log.country === "AU");
  if (isIPIgnored) {
    continue;
  }
  if (!log.agent) {
    continue;
  }
  if (isAgentIgnored(log.agent)) {
    continue;
  }
  if (!getURLGroup(log.url)) {
    continue;
  }
  logs.push(log);
}

for (const log of logs) {
  console.log(log);
}
console.log();

function logAgentRequestsTable() {
  const counts = new Map();
  for (const log of logs) {
    let count = 0;
    if (counts.has(log.agent)) {
      count = counts.get(log.agent);
    }
    counts.set(log.agent, count + 1);
  }
  const table = [];
  for (const [k, v] of counts) {
    table.push({ agent: k.slice(0, 75), count: v });
  }
  table.sort((a, b) => b.count - a.count);
  console.log("Agents:");
  console.table(table);
  console.log();
}
logAgentRequestsTable();

function getURLGroup(url) {
  for (const group of urlGroups) {
    if (url.match(group)) {
      return group;
    }
  }
  for (const file of staticFiles) {
    if (url === "/" + file) {
      return file;
    }
  }
  return null;
}

function logUrlRequestsTable() {
  const counts = new Map();
  for (const log of logs) {
    const group = getURLGroup(log.url);
    assert(group);
    let count = 0;
    if (counts.has(group)) {
      count = counts.get(group);
    }
    counts.set(group, count + 1);
  }
  const table = [];
  for (const [k, v] of counts) {
    table.push({ url: String(k).slice(0, 75), count: v });
  }
  table.sort((a, b) => b.count - a.count);
  console.log("URLs:");
  console.table(table);
  console.log();
}
logUrlRequestsTable();

function logDuration() {
  const durations = allLogs
    .filter((l) => typeof l.duration === "number")
    .map((l) => l.duration);
  assert(durations.every((d) => isFinite(d)));
  durations.sort();
  const q = durations[Math.floor(durations.length * 0.999)];
  console.log(`99.9% Quantile: ${Math.round(q)} ms`);
}
logDuration();
