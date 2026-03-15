FROM oven/bun:1
WORKDIR /app

# Copy root workspace config
COPY package.json bun.lock turbo.json ./

# Copy packages and app source
COPY packages ./packages
COPY apps/worker ./apps/worker

# Install dependencies
RUN bun install

# Set working directory to worker
WORKDIR /app/apps/worker

# Create the workspace directory inside the container
RUN mkdir -p /tmp/vibecode-workspaces

# Start the worker
CMD ["bun", "run", "src/index.ts"]
