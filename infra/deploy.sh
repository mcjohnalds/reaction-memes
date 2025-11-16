#!/bin/bash
ssh reaction-memes@5.78.119.234 bash -s <<'EOF'
set -e
cd ~/reaction-memes
output=$(git pull)
echo $output
case "$output" in
  *"Updating"*)
    echo Restarting service.
    sudo /usr/bin/systemctl restart reaction-memes
    i=0
    until curl -sfI -o /dev/null http://localhost:8080; do
      sleep 0.1
      i=$((i + 1))
      if [ $i -eq 20 ]; then
        echo Server is down!
        exit 1
      fi
    done
    echo Deploy complete.
    ;;
  *"Already up to date"*)
    ;;
  *)
    exit 1
    ;;
esac
EOF
if [ $? -ne 0 ]; then
  echo deploy.sh failed
  exit 1
fi