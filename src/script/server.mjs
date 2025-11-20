import { createServer } from "../server.mjs";

process.title = "reaction-memes-server";
const server = await createServer("data");
server.on("listening", () => console.log("Listening on http://localhost:8080"));
server.listen(8080);
