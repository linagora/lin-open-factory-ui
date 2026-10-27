FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json server.js ./
RUN npm ci --omit=dev
USER node
CMD ["node", "server.js"]
