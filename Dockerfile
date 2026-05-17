# RepoTalk — backend (Node + Python venv) + static frontend
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

RUN npm install \
  && python3 -m venv venv \
  && ./venv/bin/pip install --upgrade pip \
  && ./venv/bin/pip install -r requirements.txt

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=development
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
