# syntax=docker/dockerfile:1
# Build context: repository root (docker compose handles this).
#
# Optional BuildKit secret `npm_ca`: extra CA bundle for networks behind a
# TLS-intercepting proxy. It is mounted only during `npm ci` and never stored
# in any image layer. Without it the build behaves normally.
#   docker build --secret id=npm_ca,src=/path/to/ca.pem -f apps/api/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true CI=true
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -s /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm_config_cafile=/run/secrets/npm_ca; fi; \
    npm ci --ignore-scripts
COPY nx.json tsconfig.base.json eslint.config.mjs ./
COPY libs ./libs
COPY apps/api ./apps/api
RUN npx nx build api --configuration=production

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3000
COPY --from=build /workspace/dist/apps/api ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -s /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm_config_cafile=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev --ignore-scripts && npm cache clean --force
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "main.js"]
