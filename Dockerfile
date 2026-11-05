# Imagen de la tienda. Sin dependencias: solo Node y los archivos del repositorio.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --chown=node:node . .
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
