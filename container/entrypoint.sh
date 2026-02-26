#!/bin/sh
# Seed persistent directories on first run.
# When Railway (or Docker) mounts an empty volume, the image contents are
# hidden. This script copies the original files from /app/_seed/* into the
# mounted volumes if they are empty.

seed_if_empty() {
  dir="$1"
  seed="$2"

  if [ ! -d "$seed" ]; then
    return
  fi

  mkdir -p "$dir"

  if [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
    echo "Seeding $dir from $seed ..."
    cp -r "$seed"/. "$dir"/
  fi
}

VOLUME="/app/appdata"

if [ -d "$VOLUME" ]; then
  # Railway: single volume mounted at /app/appdata
  seed_if_empty "$VOLUME/db"     /app/_seed/db
  seed_if_empty "$VOLUME/drafts" /app/_seed/drafts
  seed_if_empty "$VOLUME/public" /app/_seed/public

  ln -sfn "$VOLUME/db"     /app/db
  ln -sfn "$VOLUME/drafts" /app/drafts
  ln -sfn "$VOLUME/public" /app/public
else
  # Docker Compose: separate bind mounts
  seed_if_empty /app/db     /app/_seed/db
  seed_if_empty /app/drafts /app/_seed/drafts
  seed_if_empty /app/public /app/_seed/public
fi

exec "$@"
