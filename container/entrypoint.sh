#!/bin/sh
# Seed the persistent data directory on first run.
# When a PaaS (Render) or Docker mounts an empty volume over /app/data,
# the image contents are hidden. This script copies the seed files into
# the volume if it is empty.

DATA_DIR="/app/data"

mkdir -p "$DATA_DIR"

if [ -z "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  echo "Seeding $DATA_DIR from /app/_seed/data ..."
  cp -r /app/_seed/data/. "$DATA_DIR"/
fi

exec "$@"
