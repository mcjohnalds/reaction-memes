import sharp from "sharp";
import fs from "node:fs";

export async function generate() {
  await fs.promises.mkdir("data/thumbnails", { recursive: true });
  const images = await fs.promises.readdir("data/images");
  for (const [i, image] of images.entries()) {
    const name = image.split(".").at(-2);
    await sharp(`data/images/${image}`)
      .resize(200)
      .webp()
      .toFile(`data/thumbnails/${name}.webp`);
    process.stdout.write(`${i + 1} / ${images.length}\n`);
  }
}
