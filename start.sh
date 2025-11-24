#!/bin/bash
# Usage: ./start.sh [DB_USER] [DB_PASSWORD]

export DB_USER=${1:-postgres}
export DB_PASSWORD=${2:-password}
export DB_HOST=localhost
export DB_NAME=postgres
export PORT=3000

echo "Starting server with DB_USER=$DB_USER"
node init_db.js
node server.js
