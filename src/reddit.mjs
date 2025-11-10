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

const maxImages = 10;

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
  const medias = getMedias(token.access_token);
  for await (const media of medias) {
    const [, extension] = media.m.split("/");
    const destination = `data/images/${media.id}.${extension}`;
    // CLIP was trainined on 214x214 px images which tends to be the 2nd image
    const p = media.p[1] ?? media.p[0];
    const res = await fetch(p.u);
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
    limit: 2,
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

async function* getMedias(accessToken) {
  await fs.promises.mkdir("data/images", { recursive: true });
  let after;
  do {
    const posts = await getNewPosts(accessToken, after);
    after = posts.data.after;
    for (const post of posts.data.children) {
      const medias = Object.values(post.data.media_metadata);
      for (const media of medias) {
        yield media;
      }
    }
  } while (after);
}
