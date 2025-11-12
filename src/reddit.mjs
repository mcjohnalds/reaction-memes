import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
import fs from "node:fs";
import {
  clientId,
  clientSecret,
  username,
  password,
  getUserAgent,
} from "./shared.mjs";

const maxImages = 10_000;
const scrapeLogFile = "data/scrape-requests.jsonl";

export async function authenticate() {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "post",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "User-Agent": getUserAgent(),
    },
    body: new URLSearchParams({
      grant_type: "password",
      username,
      password,
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  await fs.promises.mkdir("data", { recursive: true });
  await fs.promises.writeFile("data/token.json", JSON.stringify(json, null, 2));
}

export async function scrape() {
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
    const progress = `${n} / ${maxImages}`;
    if (exists) {
      process.stdout.write(`${progress} - ${fileName} exists, skipping\n`);
    } else {
      await saveImage(image);
      process.stdout.write(`${progress} - ${fileName} saved\n`);
      await setTimeout(1000);
    }
    if (n === maxImages) {
      return;
    }
  }
  process.stdout.write("scrape complete\n");
}

async function saveImage(url) {
  const res = await fetch(url);
  await logRequest({
    url,
    status: res.status,
    headers: res.headers,
  });
  assert.equal(res.status, 200);
  const stream = Readable.fromWeb(res.body);
  const tmp = `/data/scrape-image-temporary`;
  await fs.promises.writeFile(tmp, stream);
  await fs.promises.rename(tmp, destination);
}

async function getNewPosts(accessToken, after) {
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
  const url = `https://oauth.reddit.com/r/${subreddit}/new.json?${params}`;
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
  let after;
  do {
    const posts = await getNewPosts(accessToken, after);
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
  } while (after);
}

async function logRequest(data) {
  const log = { timestamp: new Date().toISOString(), ...data };
  const str = JSON.stringify(log) + "\n";
  await fs.promises.appendFile(scrapeLogFile, str);
}
