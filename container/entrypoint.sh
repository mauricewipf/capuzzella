#!/bin/sh
# Seed persistent directories on first run.
# When Railway (or Docker) mounts an empty volume over /app/data, /app/drafts,
# or /app/public, the image contents are hidden. This script copies the
# original files from /app/_seed/* into the mounted volumes if they are empty.

seed_if_empty() {
  dir="$1"
  seed="/app/_seed$(echo "$dir" | sed 's|/app||')"

  if [ ! -d "$seed" ]; then
    return
  fi

  # Directory is considered empty when it has no visible entries
  if [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
    echo "Seeding $dir from $seed ..."
    cp -r "$seed"/. "$dir"/
  fi
}

seed_if_empty /app/data
seed_if_empty /app/drafts
seed_if_empty /app/public

exec "$@"
