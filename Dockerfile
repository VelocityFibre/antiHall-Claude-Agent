# antiHall Claude Agent Docker Container
FROM node:20-alpine

# Install git for cloning repos
RUN apk add --no-cache git python3 make g++

# Set working directory
WORKDIR /antihall

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Build TypeScript
RUN npm run build

# Create volume mount point for project to analyze
VOLUME ["/project"]

# Default to help command
CMD ["node", "bin/antihall.js", "--help"]