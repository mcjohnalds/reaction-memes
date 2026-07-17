#!/bin/sh
set -x

cert=$(aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='reactionmemes.app'].CertificateArn | [0]" \
  --output text) || exit 1

[ -n "$cert" ] && [ "$cert" != None ] || exit 1

aws cloudformation deploy \
  --region us-east-1 \
  --stack-name reaction-memes-monitoring \
  --template-file monitoring.yaml || exit 1

origin() {
  aws ec2 describe-instances \
    --filters Name=tag:Name,Values=reaction-memes \
    Name=instance-state-name,Values=running \
    --query "Reservations[].Instances[].PublicDnsName | [0]" \
    --output text
}

deploy_stack() {
  aws cloudformation deploy \
    --stack-name reaction-memes \
    --capabilities CAPABILITY_IAM \
    --template-file cloudformation.yaml \
    --parameter-overrides "CertificateArn=$cert" "OriginDomainName=$1"
}

# First pass creates the instance; second pass points CloudFront at its current
# public DNS, self-healing whenever the instance IP changes.
o=$(origin) || exit 1

deploy_stack "${o:-none.invalid}" || exit 1

o=$(origin) || exit 1

[ -n "$o" ] && [ "$o" != None ] || exit 1

deploy_stack "$o" || exit 1

uri=$(aws cloudformation describe-stacks \
  --stack-name reaction-memes \
  --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" \
  --output text) || exit 1

registry=${uri%/*}

region=$(aws configure get region) || exit 1

tag=$(git rev-parse --short HEAD) || exit 1

aws ecr get-login-password |
  docker login --username AWS --password-stdin "$registry" || exit 1

docker build --platform linux/arm64 \
  -t "$uri:$tag" -t "$uri:latest" . || exit 1

docker push "$uri:$tag" || exit 1

docker push "$uri:latest" || exit 1

bin/ssh.sh bash -ls <<EOF || exit 1
set -x
aws ecr get-login-password --region $region |
  docker login --username AWS --password-stdin $registry || exit 1
docker pull $uri:$tag || exit 1
docker rm -f reaction-memes 2>/dev/null || true
docker run -d \
  --name reaction-memes \
  --restart on-failure:5 \
  --memory 1500m \
  --memory-swap 1500m \
  --cpus 1.5 \
  --pids-limit 512 \
  -p 80:8080 \
  $uri:$tag || exit 1
for i in \$(seq 1 30); do
  curl -sf -o /dev/null http://localhost && exit 0
  sleep 1
done
exit 1
EOF
