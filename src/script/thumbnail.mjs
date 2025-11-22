import sharp from "sharp";
import fs from "node:fs";

await fs.promises.rm("data/thumbnails", { recursive: true, force: true });
await fs.promises.mkdir("data/thumbnails", { recursive: true });
const images = await fs.promises.readdir("data/images");
for (const [i, file] of images.entries()) {
  await sharp(`data/images/${file}`)
    .resize({
      width: 200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 30 })
    .toFile(`data/thumbnails/${file}`);
  if (i % 100 === 0) {
    process.stdout.write(`${i + 1} / ${images.length}\n`);
  }
}
