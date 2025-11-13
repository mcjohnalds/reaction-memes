const command = process.argv[2];
if (command === "auth") {
  const reddit = await import("./reddit.mjs");
  await reddit.authenticate();
} else if (command === "scrape") {
  const reddit = await import("./reddit.mjs");
  await reddit.scrape();
} else if (command === "scrape-shift") {
  const redditShift = await import("./reddit-shift.mjs");
  await redditShift.scrape();
} else if (command === "encode") {
  const clip = await import("./clip.mjs");
  await clip.encodeImages();
} else if (command === "thumbnail") {
  const thumbnail = await import("./thumbnail.mjs");
  await thumbnail.generate();
} else if (command === "server") {
  const api = await import("./api.mjs");
  const server = api.createServer();
  server.listen(8080);
} else if (command === "clean") {
  const fs = await import("node:fs");
  await fs.promises.rm("data/images", { recursive: true, force: true });
  await fs.promises.rm("data/encodings.json", { recursive: true, force: true });
} else {
  throw new Error("Error: unknown command");
}
