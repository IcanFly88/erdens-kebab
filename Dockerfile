# Erdens Kebab backend + éttermi panel (Render, Railway vagy bármilyen Docker tárhely).
# Csak a szerverhez szükséges fájlok kerülnek be (az étlapot és a státusz-logikát megosztja az appal).
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/data/erdens.db

COPY server/src ./server/src
COPY server/panel ./server/panel
COPY src/data ./src/data
COPY src/lib/order-status.ts ./src/lib/order-status.ts

# Az adatbázis a /data kötetre kerül (Railway-n tartós volume-ként csatoljuk).
RUN mkdir -p /data

EXPOSE 4000
CMD ["node", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "server/src/index.ts"]
