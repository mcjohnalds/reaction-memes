#!/bin/sh
set -x

instance_id=$(aws cloudformation describe-stacks \
  --stack-name reaction-memes \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
  --output text) || exit 1

key=$(mktemp -u) || exit 1
ssh-keygen -q -t ed25519 -N '' -f "$key" || exit 1

aws ec2-instance-connect send-ssh-public-key \
  --instance-id "$instance_id" \
  --instance-os-user root \
  --ssh-public-key "file://$key.pub" >/dev/null || exit 1

proxy="aws ssm start-session --target %h"
proxy="$proxy --document-name AWS-StartSSHSession"
proxy="$proxy --parameters portNumber=%p"

ssh \
  -i "$key" \
  -o IdentitiesOnly=yes \
  -o PreferredAuthentications=publickey \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=5 \
  -o ServerAliveCountMax=3 \
  -o ProxyCommand="$proxy" \
  "root@$instance_id" "$@"
