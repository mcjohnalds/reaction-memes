import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
import fs from "node:fs";
import { getUserAgent } from "../src/reddit.mjs"

const scrapeLogFile = "data/scrape-requests.jsonl";

async function saveImage(destination, url) {
  const res = await fetch(url);
  await logRequest({
    url,
    status: res.status,
    headers: res.headers,
  });
  assert.equal(res.status, 200);
  const stream = Readable.fromWeb(res.body);
  const tmp = `data/scrape-image-temporary`;
  await fs.promises.writeFile(tmp, stream);
  await fs.promises.rename(tmp, destination);
}

async function listSubreddit(sort, accessToken, after) {
  const subreddit = "ReactionMemes";
  const params = new URLSearchParams({
    limit: 100,
    raw_json: 1,
  });
  if (after) {
    params.set("after", after);
  }
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": getUserAgent(),
  };
  const url = `https://oauth.reddit.com/r/${subreddit}/${sort}.json?${params}`;
  const res = await fetch(url, { headers });
  const json = await res.json();
  await logRequest({
    url,
    status: res.status,
    headers: res.headers,
    body: json,
  });
  assert.equal(res.status, 200);
  return json;
}

async function* getImages(accessToken) {
  await fs.promises.mkdir("data/images", { recursive: true });
  for (const sort of ["new", "top"]) {
    let after;
    do {
      const posts = await listSubreddit(sort, accessToken, after);
      after = posts.data.after;
      for (const post of posts.data.children) {
        if (post.data.media_preview) {
          for (const media of Object.values(post.data.media_preview)) {
            yield media.p.at(-1);
          }
        }
        if (post.data.preview) {
          yield post.data.preview.images[0].source.url;
        }
      }
      await setTimeout(1_000);
    } while (after);
  }
}

async function logRequest(data) {
  const log = { timestamp: new Date().toISOString(), ...data };
  const str = JSON.stringify(log) + "\n";
  await fs.promises.appendFile(scrapeLogFile, str);
}

await fs.promises.rm(scrapeLogFile, { force: true });
const tokenFile = await fs.promises.readFile("./data/token.json", {
  encoding: "utf8",
});
const token = JSON.parse(tokenFile);
let n = 0;
const images = getImages(token.access_token);
for await (const image of images) {
  n++;
  const fileName = new URL(image).pathname.substring(1);
  const destination = `data/images/${fileName}`;
  const exists = await fs.promises
    .access(destination)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    process.stdout.write(`${n} exists ${fileName}\n`);
  } else {
    await saveImage(destination, image);
    process.stdout.write(`${n} saved ${fileName}\n`);
    await setTimeout(1_000);
  }
}
process.stdout.write("scrape complete\n");
