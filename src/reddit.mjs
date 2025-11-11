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

const maxImages = 1_000;

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
  const tokenFile = await fs.promises.readFile("./data/token.json", {
    encoding: "utf8",
  });
  const token = JSON.parse(tokenFile);
  let n = 0;
  const images = getImages(token.access_token);
  for await (const image of images) {
    const fileName = new URL(image).pathname.substring(1);
    const destination = `data/images/${fileName}`;
    const res = await fetch(image);
    assert.equal(res.status, 200);
    const stream = Readable.fromWeb(res.body);
    const tmp = `/tmp/auto-reaction-meme-image`;
    await fs.promises.writeFile(tmp, stream);
    await fs.promises.rename(tmp, destination);
    await setTimeout(1000);
    n++;
    process.stdout.write(`${n}/${maxImages}\n`);
    if (n === maxImages) {
      return;
    }
  }
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
  const res = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/new.json?${params}`,
    { headers },
  );
  return await res.json();
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
