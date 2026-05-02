FROM node:18-alpine

# Install certs
RUN apk add --no-cache ca-certificates

WORKDIR /usr/src/app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json* ./

# Install deps
RUN npm install --production

# Copy app
COPY . .

EXPOSE 4000

CMD ["node", "index.js"]
