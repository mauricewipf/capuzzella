FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy application code
COPY src/ ./src/
COPY editor/ ./editor/
COPY scripts/ ./scripts/
COPY static/ ./static/
COPY components/ ./components/

# Copy mutable data directory (db, drafts, public).
# A seed copy lets the entrypoint populate an empty volume on first run.
COPY data/ ./data/
RUN mkdir -p ./_seed \
    && cp -r ./data ./_seed/data

# Copy entrypoint script
COPY container/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Set ownership to bun user (UID 1000)
RUN chown -R bun:bun /app

# Switch to bun user
USER bun

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use entrypoint script to seed volumes, then start the production server
ENTRYPOINT ["./entrypoint.sh"]
CMD ["bun", "run", "src/server.js"]
