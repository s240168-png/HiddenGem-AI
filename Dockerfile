FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Do not bake local secrets or git metadata into the image.
RUN rm -f .env

EXPOSE 3000
CMD ["node", "server/server.js"]
