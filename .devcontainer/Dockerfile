FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

RUN apt-get update \
 && apt-get install -y \
        iputils-ping \
        redis-server \
 && rm -rf /var/lib/apt/lists/*

# Replace curl | bash with a safer alternative
RUN curl -o /tmp/qlty.sh https://qlty.sh \
 && chmod +x /tmp/qlty.sh \
 && /tmp/qlty.sh \
 && mv ~/.qlty/bin/qlty /usr/local/bin/qlty \
 && rm -rf ~/.qlty /tmp/qlty.sh