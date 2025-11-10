import { setTimeout } from "node:timers/promises";
import { Readable } from "node:stream";
import fs from "node:fs";
import token from "./token.json" with { type: "json" };
import { getUserAgent } from "./shared.mjs";

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

await fs.promises.mkdir("images", { recursive: true });
let posts;
do {
  posts = await getNewPosts();
  let i = 0;
  for (const post of posts.data.children) {
    const medias = Object.entries(post.data.media_metadata);
    for (const [id, media] of medias) {
      const [, extension] = media.m.split("/");
      const destination = `images/${id}.${extension}`;
      // CLIP was trainined on 214x214 px images which tends to be the 2nd image
      const p = media.p[1] ?? media.p[0];
      const res = await fetch(p.u);
      const stream = Readable.fromWeb(res.body);
      await fs.promises.writeFile(destination, stream);
      await setTimeout(1000);
      i++;
      if (i === 3) {
        process.exit(0);
      }
    }
  }
} while (posts.after);
