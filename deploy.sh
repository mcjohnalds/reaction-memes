#!/bin/bash
ssh reaction-memes@hmain bash -s <<EOF
set -ex
cd ~/reaction-memes
git pull
npm install
sudo /usr/bin/systemctl restart reaction-memes
sleep 3
curl -sf -o /dev/null http://localhost:8080
EOF
if [ "$?" -eq 0 ]; then
  echo deploy.sh succeeded
else
  echo deploy.sh failed
  exit 1
fi