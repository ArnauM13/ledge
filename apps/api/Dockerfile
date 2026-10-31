# syntax=docker/dockerfile:1
# Build context: repository root  (docker compose handles this).

FROM node:22-alpine AS build
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true CI=true
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY nx.json tsconfig.base.json eslint.config.mjs ./
COPY libs ./libs
COPY apps/api ./apps/api
RUN npx nx build api --configuration=production

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3000
COPY --from=build /workspace/dist/apps/api ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "main.js"]
