#!/bin/sh
ssh reaction-memes@hmain \
  "journalctl -u reaction-memes.service -rq -o short-iso -n 100 -g error" \
  | less -S
