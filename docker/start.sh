#!/bin/sh

# Exit immediately if a command exits with a non-zero status
set -e

# Print startup banner
printf "%.0s=" {1..42}; echo
printf "Starting Issue Analyzer System v1.0\n"
printf "%.0s=" {1..42}; echo

# Start Nginx in the background
printf "Starting Nginx... "
if nginx; then
    echo "[OK]"
else
    echo "[FAILED]"
    exit 1
fi

# Start Node.js backend
printf "Starting Node.js backend... "
cd /app/backend
export NODE_ENV=production
node server.js
