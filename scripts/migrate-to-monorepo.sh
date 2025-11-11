#!/bin/bash

# Monorepo Migration Script
# This script helps migrate the current project to a monorepo structure

set -e

echo "🚀 Starting Monorepo Migration..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Create backup
echo -e "${YELLOW}📦 Creating backup...${NC}"
BACKUP_DIR="../txt2voice-backup-$(date +%Y%m%d-%H%M%S)"
cp -r . "$BACKUP_DIR"
echo -e "${GREEN}✓ Backup created at $BACKUP_DIR${NC}"

# Create apps/web directory
echo -e "${YELLOW}📁 Creating apps/web directory...${NC}"
mkdir -p apps/web

# Move files to apps/web
echo -e "${YELLOW}📦 Moving files to apps/web...${NC}"

# Core directories - use rsync to merge directories
for dir in src prisma public; do
    if [ -d "$dir" ]; then
        if [ -d "apps/web/$dir" ]; then
            # Directory exists, merge contents
            rsync -a "$dir/" "apps/web/$dir/"
            rm -rf "$dir"
            echo -e "${GREEN}✓ Merged $dir${NC}"
        else
            # Directory doesn't exist, move it
            mv "$dir" apps/web/
            echo -e "${GREEN}✓ Moved $dir${NC}"
        fi
    fi
done

# Config files
for file in next.config.js tsconfig.json tailwind.config.js postcss.config.js eslint.config.mjs prisma.config.ts; do
    if [ -f "$file" ]; then
        mv "$file" apps/web/
        echo -e "${GREEN}✓ Moved $file${NC}"
    fi
done

# Test files
for file in test-*.js debug-*.js; do
    if [ -f "$file" ]; then
        mv "$file" apps/web/
        echo -e "${GREEN}✓ Moved $file${NC}"
    fi
done

# Data files
for file in 1.txt 1_utf8.txt; do
    if [ -f "$file" ]; then
        mv "$file" apps/web/
        echo -e "${GREEN}✓ Moved $file${NC}"
    fi
done

# Move package files
echo -e "${YELLOW}📦 Moving package files...${NC}"
mv package.json apps/web/package.json
if [ -f "package-lock.json" ]; then
    mv package-lock.json apps/web/
fi
if [ -f "pnpm-lock.yaml" ]; then
    # Keep pnpm-lock.yaml at root for now, will be regenerated
    rm pnpm-lock.yaml
fi

# Move .env.example
if [ -f ".env.example" ]; then
    mv .env.example apps/web/
    echo -e "${GREEN}✓ Moved .env.example${NC}"
fi

# Rename package.root.json to package.json
if [ -f "package.root.json" ]; then
    mv package.root.json package.json
    echo -e "${GREEN}✓ Renamed package.root.json to package.json${NC}"
fi

# Update .gitignore
if [ -f ".gitignore.monorepo" ]; then
    mv .gitignore .gitignore.old
    mv .gitignore.monorepo .gitignore
    echo -e "${GREEN}✓ Updated .gitignore${NC}"
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}⚠️  pnpm is not installed. Installing...${NC}"
    npm install -g pnpm@8.15.0
    echo -e "${GREEN}✓ pnpm installed${NC}"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install

echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Copy .env.docker to .env and configure your environment variables"
echo "2. Review MONOREPO_MIGRATION.md for detailed instructions"
echo "3. Test the application with: pnpm dev"
echo "4. Build Docker containers with: pnpm docker:build"
echo ""
echo "Backup location: $BACKUP_DIR"
