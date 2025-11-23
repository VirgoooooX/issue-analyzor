#!/bin/bash

# 构建多架构Docker镜像脚本
# 支持AMD64和ARM64架构

echo "=========================================="
echo "Building Multi-Arch Docker Images"
echo "=========================================="

# 检查是否安装了buildx
if ! docker buildx version > /dev/null 2>&1; then
    echo "Error: Docker Buildx is not installed"
    echo "Please install Docker Buildx to build multi-arch images"
    exit 1
fi

# 创建并使用新的builder实例
echo "Creating new builder instance..."
docker buildx create --name multiarch-builder --use || true

# 启动builder实例
echo "Starting builder instance..."
docker buildx inspect --bootstrap

# 构建并推送多架构镜像
echo "Building multi-arch image..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t issue-analyzer:latest \
    --push \
    .

echo "Multi-arch image build completed!"
echo "Supported architectures: AMD64, ARM64"