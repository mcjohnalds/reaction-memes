import assert from "node:assert/strict";
import fs from "node:fs";
import {
  clientId,
  clientSecret,
  username,
  password,
  getUserAgent,
} from "../reddit.mjs";

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
assert.equal(res.status, 200);
const json = await res.json();
await fs.promises.mkdir("data", { recursive: true });
await fs.promises.writeFile("data/token.json", JSON.stringify(json, null, 2));
