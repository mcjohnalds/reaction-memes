#!/bin/sh
GREP='^{.*"path":"/search'
bin/ssh.sh "docker logs --tail 5000 reaction-memes 2>&1 | grep '$GREP'" |
  mlr --j2p flatten then unsparsify \
    then rename headers.cf-ipcountry,country,headers.x-forwarded-for,ip,headers.user-agent,agent \
    then cut -of time,status,method,path,duration,country,ip,agent \
    then filter '$path =~ "^/search[?]"' | less -S
