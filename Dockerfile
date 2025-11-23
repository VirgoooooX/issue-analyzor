# Multi-stage build for Issue Analyzer System
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy frontend source
COPY frontend/ ./

# Build frontend and clean cache
RUN npm run build && npm cache clean --force

# Stage 2: Build backend and final image
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Install build dependencies for native modules (canvas requires these)
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies
# Note: This will automatically install lru-cache and other new dependencies from package.json
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Final minimal image
FROM node:18-alpine

# Install runtime dependencies for canvas and other system dependencies
RUN apk add --no-cache \
    nginx \
    sqlite \
    cairo \
    jpeg \
    pango \
    giflib \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy backend dependencies and source
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Copy database init script
COPY database/ ./database/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Create necessary directories
RUN mkdir -p /app/data /app/backend/uploads /app/backend/logs && \
    # Create nginx user if it doesn't exist
    (id -u nginx &>/dev/null || adduser -D -S -H -s /sbin/nologin nginx) || true

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

# Remove unnecessary files
RUN rm -rf /app/backend/node_modules/*/.*cache* \
    /app/backend/node_modules/*/*.md \
    /app/backend/node_modules/*/README* \
    /app/backend/node_modules/*/test* \
    /app/backend/node_modules/*/examples* \
    /app/backend/node_modules/*/docs* || true

# Expose port
EXPOSE 80

# Start services
CMD ["/start.sh"]
