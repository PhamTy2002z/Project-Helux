FROM openclaw/gateway:latest

# Install tools needed by agents at runtime
USER root
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends jq curl \
    && rm -rf /var/lib/apt/lists/*

# Update openclaw to latest version
RUN npm i -g --force openclaw@latest \
    && cp $(readlink -f /usr/local/bin/openclaw) /app/openclaw.mjs \
    && dir=$(dirname $(readlink -f /usr/local/bin/openclaw)) \
    && cp $dir/package.json /app/package.json \
    && npm cache clean --force
USER node
