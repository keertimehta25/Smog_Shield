# syntax=docker/dockerfile:1
# Works on Google Cloud Run, Render (Docker runtime), Fly.io, Railway and any container host.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY shared ./shared
COPY server ./server
COPY --from=build /app/dist ./dist
USER node
# Hosts such as Cloud Run inject PORT (usually 8080); the app reads it at startup.
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "server/index.ts"]
