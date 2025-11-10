import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
import fs from "node:fs";
import token from "./token.json" with { type: "json" };
import { getUserAgent } from "./shared.mjs";

const maxImages = 10;

async function getNewPosts(after) {
  const subreddit = "ReactionMemes";
  const params = new URLSearchParams({
    limit: 2,
    raw_json: 1,
  });
  if (after) {
    params.set("after", after);
  }
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    "User-Agent": getUserAgent(),
  };
  const res = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/new.json?${params}`,
    { headers },
  );
  return await res.json();
}

async function* getMedias() {
  await fs.promises.mkdir("images", { recursive: true });
  let posts;
  do {
    posts = await getNewPosts();
    for (const post of posts.data.children) {
      const medias = Object.values(post.data.media_metadata);
      for (const media of medias) {
        yield media;
      }
    }
  } while (posts.data.after);
}

async function main() {
  let n = 0;
  for await (const media of getMedias()) {
    const [, extension] = media.m.split("/");
    const destination = `images/${media.id}.${extension}`;
    // CLIP was trainined on 214x214 px images which tends to be the 2nd image
    const p = media.p[1] ?? media.p[0];
    const res = await fetch(p.u);
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

main();
