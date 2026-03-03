# Official Docker Hub Node image.
ARG NODE_BASE_IMAGE=node:20-alpine
FROM ${NODE_BASE_IMAGE}

WORKDIR /app

# Install frontend dependencies.
# Use npm install (not npm ci) so build does not fail when lock file is behind package.json.
COPY package*.json /app/
RUN npm install --no-audit --no-fund

COPY . /app

# Build-time API URL (default points directly to backend host).
ARG VITE_API_BASE_URL=http://localhost:8000/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3001"]
