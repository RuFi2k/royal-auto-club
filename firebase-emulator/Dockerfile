FROM node:20-trixie-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      openjdk-21-jre-headless ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g firebase-tools

WORKDIR /app
COPY firebase.json .firebaserc storage.rules entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 9099 9199 4000 4400 4500

CMD ["./entrypoint.sh"]
