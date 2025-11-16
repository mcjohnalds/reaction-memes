#!/bin/bash
echo node --test
output=$(node --test --test-reporter spec)
if [ $? -ne 0 ]; then
  echo "$output"
  exit 1
fi
echo ssh
ssh reaction-memes@5.78.119.234 bash -s <<'EOF'
set -e
cd ~/reaction-memes
echo git pull
output=$(git pull)
echo "$output"
case "$output" in
  *"Updating"*)
    echo systemctl restart reaction-memes
    sudo /usr/bin/systemctl restart reaction-memes
    ;;
  *"Already up to date"*)
    ;;
  *)
    exit 1
    ;;
esac
echo curl
i=0
until curl -sfI -o /dev/null http://localhost:8080; do
  sleep 0.1
  i=$((i + 1))
  if [ $i -eq 20 ]; then
    echo Server is down!
    exit 1
  fi
done
echo Server is up.
echo Deploy complete.
EOF
if [ $? -ne 0 ]; then
  echo deploy.sh failed
  exit 1
fi