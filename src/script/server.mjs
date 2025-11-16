import { createServer } from "../server.mjs";

const server = createServer();
server.on("listening", () => console.log("Listening"));
server.listen(8080);
