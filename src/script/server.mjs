import { createServer } from "../server.mjs";

process.title = "reaction-memes-server";
const server = await createServer("data");
server.on("listening", () => console.log("Listening"));
server.listen(8080);
