#!/bin/sh
GREP='^{.*"url":"/search'
ssh reaction-memes@hmain \
  "journalctl -u reaction-memes.service -rq -o cat -n 100 -g '$GREP'" \
  | mlr --j2p unsparsify \
  then cut \
  -of time,method,url,status,ip,country,duration,agent \
  then filter '$url =~ "^/search[?]"' | less -S
