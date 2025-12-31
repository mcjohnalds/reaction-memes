#!/bin/bash
ssh reaction-memes@lmain bash -ls <<EOF
set -ex
cd ~/reaction-memes
git pull
npm install
systemctl --user daemon-reload
systemctl --user restart reaction-memes
sleep 3
curl -sf -o /dev/null http://localhost:8082
EOF
if [ "$?" -eq 0 ]; then
  echo deploy.sh succeeded
else
  echo deploy.sh failed
  exit 1
fi
