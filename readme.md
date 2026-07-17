Find the perfect meme.

<https://reactionmemes.app/>

Systems requirements:

- glibc (onnxruntime-node requires this)
- node.js v26
- npm
- docker

Run scripts in `./bin` to generate `./data` or find an existing copy.

## First Deploy

1. Create the ACM certificate (must be `us-east-1` for CloudFront):

   ```
   arn=$(aws acm request-certificate --region us-east-1 \
     --domain-name reactionmemes.app --validation-method DNS \
     --query CertificateArn --output text)
   aws acm describe-certificate --region us-east-1 --certificate-arn "$arn" \
     --query "Certificate.DomainValidationOptions[].ResourceRecord" \
     --output table
   ```

2. Add the CNAME record to the Cloudflare DNS and wait for validation:

   ```
   aws acm wait certificate-validated --region us-east-1 \
     --certificate-arn "$arn"
   ```

3. Deploy with the docker daemon running:

   ```
   AWS_PROFILE=reaction-memes ./bin/deploy.sh
   ```

4. Point `reactionmemes.app` at the stack's `DistributionDomainName` output with
   a CNAME record in Cloudflare. The site is now live.

- Confirm the SNS subscription from the email AWS sent to you.

## Subsequent Deploys

Run `AWS_PROFILE=reaction-memes ./bin/deploy.sh`.

## Infra

- Cloudflare DNS.
- CloudFormation stacks in AWS account 220664822842.
