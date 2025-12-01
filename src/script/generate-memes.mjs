import { setTimeout } from "node:timers/promises";
import fs from "node:fs";
import sharp from "sharp";
import { getSQL } from "../sql.mjs";
import { encodeImage, encodeText } from "../clip.mjs";
import { dotProduct } from "../math.mjs";
import uuidv7 from "../uuidv7.mjs";
import assert from "node:assert";

const postsFilePath = "data/shift/reactionmemes.jsonl";
const naughtyEmbedding = await encodeText("nigga");
const sql = getSQL("data");

async function main(dataDirectory) {
  await generateMemes(dataDirectory);
  await generateMemeSimilarities();
}

async function generateMemes(dataDirectory) {
  await fs.promises.mkdir(`${dataDirectory}/memes`, {
    recursive: true,
  });
  await fs.promises.mkdir(`${dataDirectory}/cached-responses`, {
    recursive: true,
  });
  await fs.promises.mkdir(`${dataDirectory}/thumbnails`, {
    recursive: true,
  });
  const posts = await readPostsFile();
  for (const [i, post] of posts.entries()) {
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

async function generateMemeSimilarities() {
  let n = 1;
  const as = sql.iterate`SELECT id, json(embedding) AS embedding FROM meme`;
  for (const a of as) {
    const aEmbedding = JSON.parse(a.embedding);
    console.log(`Similarity ${n++}`);
    sql.run`DELETE FROM similar_meme WHERE a = ${a.id} OR b = ${a.id}`;
    const bs = sql.iterate`SELECT id, json(embedding) AS embedding FROM meme WHERE id > ${a.id}`;
    for (const b of bs) {
      const similarity = dotProduct(aEmbedding, JSON.parse(b.embedding));
      if (similarity > 0.97) {
        sql.run`
        INSERT INTO similar_meme(a, b)
        VALUES(${a.id}, ${b.id})
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
    SELECT id, json(embedding) AS embedding
    FROM meme
    WHERE source = ${url}
  `;
  const id = existingMeme?.id ?? uuidv7();
  const memeFile = `${dataDirectory}/memes/${id.toHex()}.webp`;
  const thumbnailFile = `${dataDirectory}/thumbnails/${id.toHex()}.webp`;
  const image = await sharp(bytes);
  const { width, height } = await image.metadata();
  await image
    .resize({
      width: 1000,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toFile(memeFile);
  await image
    .resize({
      width: 200,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 50 })
    .toFile(thumbnailFile);
  const embedding = await encodeImage(memeFile);
  const naughty = dotProduct(naughtyEmbedding, embedding) > 0.99;
  sql.run`
    INSERT INTO meme(id, embedding, width, height, naughty, source)
    VALUES(
      ${id},
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
      naughty = excluded.naughty,
      source = excluded.source
  `;
}

/**
 * Get image from URL. Retry 5XX responses and network errors. Cache responses.
 */
async function getImage(url, dataDirectory) {
  const cachedResponse = sql.get`
    SELECT id FROM cached_response WHERE url = ${url}
  `;
  let bytes = null;
  if (cachedResponse) {
    const file = `${dataDirectory}/cached-responses/${cachedResponse.id.toHex()}`;
    try {
      bytes = await fs.promises.readFile(file);
    } catch {}
  } else {
    // Wait to prevent API rate limit
    await setTimeout(1000);
    let timeout = 1000;
    while (true) {
      try {
        const response = await fetch(url, {
          headers: { "user-agent": "curl/8.1.2" },
        });
        assert(response.status < 500);
        if (response.status === 200) {
          bytes = await response.bytes();
        }
        break;
      } catch (error) {
        console.error(
          new Error("Fetch failed with retryable error", { cause: error }),
        );
        await setTimeout(timeout);
        timeout *= 2;
      }
    }
    const id = uuidv7();
    if (bytes) {
      const cacheFile = `${dataDirectory}/cached-responses/${id.toHex()}`;
      await fs.promises.writeFile(cacheFile, bytes);
    }
    sql.run`
      INSERT INTO cached_response(id, url)
      VALUES(${id}, ${url})
    `;
  }
  return bytes;
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
