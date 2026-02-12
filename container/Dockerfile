FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy application code
COPY src/ ./src/
COPY public/ ./public/
COPY editor/ ./editor/
COPY drafts/ ./drafts/

# Create data directory for SQLite database
RUN mkdir -p ./data

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production

# Run the application
CMD ["bun", "run", "src/server.js"]
