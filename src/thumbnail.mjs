import sharp from "sharp";
import fs from "node:fs";

export async function generate() {
  await fs.promises.rm("data/thumbnails", { recursive: true, force: true });
  await fs.promises.mkdir("data/thumbnails", { recursive: true });
  const images = await fs.promises.readdir("data/images");
  for (const [i, image] of images.entries()) {
    await sharp(`data/images/${image}`)
      .resize({
        width: 200,
        height: 200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp()
      .toFile(`data/thumbnails/${image}`);
    if (i % 100 === 0) {
      process.stdout.write(`${i + 1} / ${images.length}\n`);
    }
  }
}
