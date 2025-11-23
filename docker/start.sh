#!/bin/sh

echo "=========================================="
echo "Starting Failure Tracker Dashboard"
echo "=========================================="

# Start Nginx in the background
echo "Starting Nginx..."
nginx

# Start Node.js backend
echo "Starting Node.js backend..."
cd /app/backend
exec node server.js
