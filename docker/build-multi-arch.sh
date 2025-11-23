#!/bin/bash

# 构建多架构Docker镜像脚本
# 支持AMD64和ARM64架构（以及其他支持的架构）
# 使用 Docker Buildx 进行跨平台构建

set -e

echo "=========================================="
echo "Building Multi-Arch Docker Images"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否安装了 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# 检查是否安装了 buildx
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker Buildx is not installed${NC}"
    echo "Please install Docker Buildx to build multi-arch images"
    echo "Buildx is included in Docker Desktop by default"
    exit 1
fi

echo -e "${YELLOW}Detected Docker version:${NC}"
docker --version
echo ""

echo -e "${YELLOW}Detected Docker Buildx version:${NC}"
docker buildx version
echo ""

# 获取当前构建的镜像版本和标签
IMAGE_NAME="${1:-issue-analyzer}"
IMAGE_TAG="${2:-latest}"
PUSH_FLAG="${3:-}"

echo -e "${YELLOW}Build Configuration:${NC}"
echo "Image Name: $IMAGE_NAME"
echo "Image Tag: $IMAGE_TAG"
echo "Full Image: $IMAGE_NAME:$IMAGE_TAG"
echo ""

# 创建并使用新的builder实例
echo -e "${YELLOW}1. Creating/Using builder instance...${NC}"
BUILDER_NAME="multiarch-builder"

# 检查是否已存在 builder
if docker buildx ls | grep -q "$BUILDER_NAME"; then
    echo -e "${GREEN}✓ Builder '$BUILDER_NAME' already exists${NC}"
else
    echo "Creating new builder instance..."
    docker buildx create --name "$BUILDER_NAME" --use
fi

# 设置为当前 builder
docker buildx use "$BUILDER_NAME"
echo ""

# 启动builder实例
echo -e "${YELLOW}2. Bootstrapping builder instance...${NC}"
docker buildx inspect --bootstrap
echo ""

# 检查支持的架构
echo -e "${YELLOW}3. Supported platforms:${NC}"
docker buildx inspect | grep Platforms || echo "Could not detect platforms"
echo ""

# 构建多架构镜像
echo -e "${YELLOW}4. Building multi-arch image...${NC}"
echo "Platforms: linux/amd64, linux/arm64"
echo ""

if [ "$PUSH_FLAG" = "--push" ] || [ "$PUSH_FLAG" = "-p" ]; then
    echo -e "${YELLOW}Building and pushing to registry...${NC}"
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t "$IMAGE_NAME:$IMAGE_TAG" \
        --push \
        .
    echo -e "${GREEN}✓ Image pushed successfully!${NC}"
else
    echo -e "${YELLOW}Building for local use...${NC}"
    echo "Note: Multi-platform builds require --push flag to store the image"
    echo "Run with '--push' flag to push to registry after building"
    echo ""
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t "$IMAGE_NAME:$IMAGE_TAG" \
        --load \
        .
    echo -e "${GREEN}✓ Image built and loaded locally!${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Multi-arch image build completed!${NC}"
echo "=========================================="
echo ""
echo "Supported architectures:"
echo "  ✓ linux/amd64 (Intel/AMD 64-bit)"
echo "  ✓ linux/arm64 (ARM 64-bit, e.g., Apple Silicon, Raspberry Pi 4)"
echo ""
echo "Usage examples:"
echo -e "${YELLOW}Run on amd64 system:${NC}"
echo "  docker run -p 80:80 $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo -e "${YELLOW}Run on ARM64 system (Raspberry Pi 4, Apple Silicon):${NC}"
echo "  docker run -p 80:80 $IMAGE_NAME:$IMAGE_TAG"
echo ""
echo -e "${YELLOW}Deploy to Docker Compose:${NC}"
echo "  docker-compose up -d"
echo ""