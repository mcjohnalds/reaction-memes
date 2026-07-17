FROM node:26-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends libgomp1 libatomic1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Reuse the model we have already downloaded. Speeds up docker build
# dramatically.
COPY node_modules/@huggingface/transformers/.cache \
  ./node_modules/@huggingface/transformers/.cache

COPY data ./data
COPY static ./static
COPY src ./src
COPY bin ./bin

ENV PORT=8080
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "bin/server.mjs"]
