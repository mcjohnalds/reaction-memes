import { setTimeout } from "node:timers/promises";
import fs from "node:fs";
import sharp from "sharp";
import sql from "../sql.mjs";
import { encodeImage, encodeText } from "../clip.mjs";
import { dotProduct } from "../math.mjs";

const postsFilePath = "data/shift/reactionmemes.jsonl";
const badEmbedding = await encodeText("nigga");

async function main(dataDirectory) {
  await fs.promises.mkdir(`${dataDirectory}/memes`, { recursive: true });
  await fs.promises.mkdir(`${dataDirectory}/cached-responses`, {
    recursive: true,
  });
  await generateMemes(dataDirectory);
  await generateMemeSimilarities(dataDirectory);
}

async function generateMemes(dataDirectory) {
  const posts = await readPostsFile();
  const maxPosts = 1000;
  for (const [i, post] of posts.slice(0, maxPosts).entries()) {
    console.log(`Scraping ${i + 1} / ${posts.length}`);
    if (post.score < 10) {
      // Ignore low-quality posts
      continue;
    }
    let urls = [];
    if (post.media_metadata) {
      for (const media of Object.values(post.media_metadata)) {
        // Some medias have a "failed" status, indicating the media is broken.
        // Those medias lack an s field.
        //
        // Some medias are gifs which we don't want and they lack a u field
        if (media.s?.u) {
          urls.push(media.s.u);
        }
      }
    } else if (post.preview) {
      urls.push(post.preview.images[0].source.url);
    }
    for (const url of urls) {
      await scrapeURL(url, dataDirectory);
    }
  }
}

async function generateMemeSimilarities(dataDirectory) {
  let n = 1;
  const as = sql.iterate`SELECT id, json(embedding) AS embedding FROM meme`;
  for (const a of as) {
    const aEmbedding = JSON.parse(a.embedding);
    console.log(`Similarity ${n++}`);
    sql.run`DELETE FROM similar_meme WHERE a = ${BigInt(a.id)} OR b = ${BigInt(a.id)}`;
    const bs = sql.iterate`SELECT id, json(embedding) AS embedding FROM meme WHERE id > ${BigInt(a.id)}`;
    for (const b of bs) {
      const similarity = dotProduct(aEmbedding, JSON.parse(b.embedding));
      if (similarity > 0.97) {
        sql.run`
        INSERT INTO similar_meme(a, b)
        VALUES(${BigInt(a.id)}, ${BigInt(b.id)})
      `;
      }
    }
  }
}

async function scrapeURL(url, dataDirectory) {
  const bytes = await getImage(url, dataDirectory);
  if (!bytes) {
    return;
  }
  const existingMeme = sql.get`
    SELECT file, json(embedding) AS embedding
    FROM meme WHERE source = ${url}
  `;
  const memeFile =
    existingMeme?.file ?? `${dataDirectory}/memes/${crypto.randomUUID()}.webp`;
  const image = await sharp(bytes);
  const { width, height } = await image.metadata();
  await image.toFile(memeFile);
  const embedding = existingMeme?.embedding
    ? JSON.parse(existingMeme.embedding)
    : await encodeImage(memeFile);
  const naughty = dotProduct(badEmbedding, embedding) > 0.99;
  sql.run`
    INSERT INTO meme(file, embedding, width, height, naughty, source)
    VALUES(
      ${memeFile},
      jsonb(${JSON.stringify(embedding)}),
      ${BigInt(width)},
      ${BigInt(height)},
      ${BigInt(naughty)},
      ${url}
    )
    ON CONFLICT DO UPDATE SET
      embedding = excluded.embedding,
      width = excluded.width,
      height = excluded.height,
      naughty = excluded.naughty
  `;
}

/**
 * Get image from URL. Retry 5XX responses and network errors. Cache responses.
 */
async function getImage(url, dataDirectory) {
  let status;
  let bytes;
  const cachedResponse = sql.get`
    SELECT * FROM cached_response WHERE url = ${url}
  `;
  if (cachedResponse) {
    status = cachedResponse.status;
    bytes = await fs.promises.readFile(cachedResponse.file);
  } else {
    let timeout = 1000;
    while (true) {
      let error;
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "curl/8.1.2" },
        });
        status = response.status;
        bytes = await response.bytes();
        if (status < 500) {
          break;
        }
      } catch (e) {
        console.error(e);
        error = e;
      }
      if (error || response.status >= 500) {
        console.log("Retrying");
        await setTimeout(timeout);
        timeout *= 2;
      }
    }
    const uuid = crypto.randomUUID();
    const cacheFile = `${dataDirectory}/cached-responses/${uuid}`;
    await fs.promises.writeFile(cacheFile, bytes);
    sql.run`
      INSERT INTO cached_response(url, status, file)
      VALUES(${url}, ${BigInt(status)}, ${cacheFile})
    `;
    // Wait to prevent API rate limit
    await setTimeout(1_000);
  }
  if (status === 200) {
    return bytes;
  }
}

async function readPostsFile() {
  const postsFile = await fs.promises.readFile(postsFilePath, {
    encoding: "utf8",
  });
  return postsFile
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

main("data");
