import fs from "node:fs";
import {
  clientId,
  clientSecret,
  username,
  password,
  getUserAgent,
} from "./shared.mjs";

const res = await fetch("https://www.reddit.com/api/v1/access_token", {
  method: "post",
  headers: {
    Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    "User-Agent": getUserAgent(),
  },
  body: new URLSearchParams({
    grant_type: "password",
    username,
    password,
  }),
});
const json = await res.json();
await fs.promises.writeFile("token.json", JSON.stringify(json, null, 2));
