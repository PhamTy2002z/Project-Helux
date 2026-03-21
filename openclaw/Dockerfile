FROM openclaw/gateway:latest

# Install tools needed by agents at runtime
USER root
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends jq curl python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install uv (Python package manager) and nano-pdf
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
    && /root/.local/bin/uv tool install nano-pdf --python-preference system \
    && chmod -R a+rX /root/.local/share/uv /root/.local/bin \
    && ln -sf /root/.local/share/uv/tools/nano-pdf/bin/nano-pdf /usr/local/bin/nano-pdf \
    && chmod a+x /root

# Update openclaw to latest version
RUN npm i -g --force openclaw@latest \
    && cp $(readlink -f /usr/local/bin/openclaw) /app/openclaw.mjs \
    && dir=$(dirname $(readlink -f /usr/local/bin/openclaw)) \
    && cp $dir/package.json /app/package.json \
    && npm cache clean --force
USER node
