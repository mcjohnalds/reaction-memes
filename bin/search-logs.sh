#!/bin/sh
GREP='^{.*"path":"/search'
ssh reaction-memes@hmain \
  "journalctl -u reaction-memes.service -rq -o cat -n 100 -g '$GREP'" \
  | mlr --j2p flatten then unsparsify \
  then rename headers.cf-ipcountry,country,headers.x-forwarded-for,ip,headers.user-agent,agent \
  then cut -of time,status,method,path,duration,country,ip,agent \
  then filter '$path =~ "^/search[?]"' | less -S
