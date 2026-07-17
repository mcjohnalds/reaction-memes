#!/bin/sh
bin/ssh.sh "docker logs --tail 1000 reaction-memes 2>&1 | grep -i error" |
  tail -n 100 | less -S
