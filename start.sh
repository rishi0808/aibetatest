#!/bin/bash

# Cache env bindings in a temp file
CACHE_FILE=".env.bindings.cache"
ENV_FILE=".env.local"

# Only regenerate bindings if .env.local has changed or cache doesn't exist
if [ ! -f "$CACHE_FILE" ] || [ "$ENV_FILE" -nt "$CACHE_FILE" ]; then
  echo "Generating environment bindings..."
  ./bindings.sh > "$CACHE_FILE"
fi

# Read cached bindings
bindings=$(cat "$CACHE_FILE")

# Start the dev server with cached bindings
wrangler pages dev ./build/client $bindings --port 3000
