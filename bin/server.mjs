import { createServer } from "../src/server.mjs"

const port = process.env.PORT ?? 8080;
process.title = "reaction-memes-server";
const server = await createServer("data");
server.on("listening", () => console.log(`Listening on http://localhost:${port}`));
server.listen(port);
