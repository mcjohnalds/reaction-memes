#!/bin/bash
echo node --test
output=$(node --test --test-reporter spec)
if [ "$?" -ne 0 ]; then
  echo "$output"
  exit 1
fi

echo
echo ssh
ssh reaction-memes@5.78.119.234 bash -s <<'EOF'
set -e
cd ~/reaction-memes

echo
echo git pull
output=$(git pull)
echo "$output"

case "$output" in
  *"Updating"*)
    echo
    echo npm install
    output=$(npm install)
    if [ "$?" -ne 0 ]; then
      echo "$output"
      exit 1
    fi

    echo
    echo systemctl restart reaction-memes
    sudo /usr/bin/systemctl restart reaction-memes
    ;;
  *"Already up to date"*)
    ;;
  *)
    exit 1
    ;;
esac

echo
echo curl http://localhost:8080
i=0
until curl -sfI -o /dev/null http://localhost:8080; do
  sleep 0.1
  i=$((i + 1))
  if [ $i -eq 20 ]; then
    echo Server is down!
    exit 1
  fi
done
EOF

if [ "$?" -eq 0 ]; then
  echo
  echo deploy.sh succeeded
else
  echo
  echo deploy.sh failed
  exit 1
fi