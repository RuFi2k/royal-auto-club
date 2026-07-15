# Production build: vite build → static files with content-hashed names,
# served by nginx (cache-busting on every deploy). Dev uses Dockerfile.dev.
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Baked into the bundle at build time (import.meta.env.VITE_API_URL).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npx vite build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
