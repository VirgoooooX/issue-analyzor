# Failure Tracker Dashboard 部署指南

## 🚀 快速开始

### 方式一：Docker部署（推荐）

#### 前置要求
- Docker 20.10+
- Docker Compose 2.0+

#### 部署步骤

1. **克隆或下载项目**
```bash
cd /path/to/failure-tracker-dashboard
```

2. **创建数据目录**
```bash
mkdir -p data
```

3. **构建并启动容器**
```bash
docker-compose up -d --build
```

4. **查看日志**
```bash
docker-compose logs -f
```

5. **访问应用**
```
浏览器打开: http://localhost
```

#### 停止服务
```bash
docker-compose down
```

#### 更新部署
```bash
docker-compose down
git pull origin main  # 如果使用Git
docker-compose up -d --build
```

---

### 方式二：本地开发

#### 前置要求
- Node.js 18+
- npm 或 yarn

#### 启动后端

1. **安装依赖**
```bash
cd backend
npm install
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑.env文件根据需要修改配置
```

3. **启动后端服务**
```bash
npm run dev
```

后端将在 http://localhost:3000 运行

#### 启动前端

1. **安装依赖**
```bash
cd frontend
npm install
```

2. **启动开发服务器**
```bash
npm run dev
```

前端将在 http://localhost:5173 运行

---

## 📊 使用指南

### 1. 上传项目

1. 点击顶部导航栏的 **"上传项目"** 按钮
2. 选择或拖拽Excel文件（M60 P1 REL FA Tracker格式）
3. 等待解析完成
4. 系统自动跳转到新项目的Dashboard

### 2. 查看Dashboard

- **概览统计卡片**：显示总Issues数、唯一Symptoms、WF数、总体失败率
- **Symptom失败率图表**：Top 10 症状及其失败率（ppm）
- **WF失败率图表**：Top 10 工作流及其失败率（ppm）
- **Config统计表格**：所有Config的详细失败率数据

### 3. 切换项目

在顶部导航栏的下拉菜单中选择不同项目

### 4. 管理项目

- **刷新**：重新加载当前项目数据
- **删除**：删除当前项目（软删除）

---

## 🔧 配置说明

### 环境变量（backend/.env）

```bash
# 服务器配置
NODE_ENV=development
PORT=3000

# 数据库配置
DATABASE_PATH=../data/failure_tracker.db

# 上传配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# CORS配置
CORS_ORIGIN=http://localhost:5173

# 日志级别
LOG_LEVEL=info
```

### Docker环境变量（docker-compose.yml）

```yaml
environment:
  - NODE_ENV=production
  - DATABASE_PATH=/app/data/failure_tracker.db
  - UPLOAD_DIR=/app/backend/uploads
  - PORT=3000
```

---

## 📁 数据持久化

### 数据库文件
- 位置：`data/failure_tracker.db`
- 备份：定期复制该文件即可

### Docker卷
```bash
# 数据库文件
./data:/app/data

# 上传的临时文件
./backend/uploads:/app/backend/uploads
```

---

## 🛠️ 维护操作

### 备份数据库
```bash
# 复制数据库文件
cp data/failure_tracker.db data/backup_$(date +%Y%m%d_%H%M%S).db

# Docker环境
docker exec failure-tracker sqlite3 /app/data/failure_tracker.db ".backup /app/data/backup.db"
docker cp failure-tracker:/app/data/backup.db ./
```

### 恢复数据库
```bash
docker-compose down
cp data/backup_20241122_120000.db data/failure_tracker.db
docker-compose up -d
```

### 查看日志
```bash
# Docker日志
docker-compose logs -f

# 后端日志
docker-compose logs app | grep "API"

# Nginx访问日志
docker exec failure-tracker tail -f /var/log/nginx/access.log
```

### 性能监控
```bash
# 容器资源使用
docker stats failure-tracker

# 数据库大小
du -h data/failure_tracker.db
```

---

## ❗ 故障排查

### 端口被占用
```bash
# 修改docker-compose.yml中的端口
ports:
  - "8080:80"  # 改为8080或其他可用端口
```

### 数据库锁定
```bash
# 等待当前操作完成，或重启容器
docker-compose restart
```

### Excel上传失败
```bash
# 检查文件大小（最大50MB）
# 增加nginx配置中的client_max_body_size
```

### API请求超时
```bash
# 增加nginx.conf中的超时设置
proxy_read_timeout 600s;
```

---

## 📋 API文档

### 项目管理

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目（上传Excel）
- `GET /api/projects/:id` - 获取项目详情
- `DELETE /api/projects/:id` - 删除项目

### 数据查询

- `GET /api/projects/:id/issues` - 获取问题列表
- `GET /api/projects/:id/filter-options` - 获取筛选选项
- `GET /api/projects/:id/analysis` - 获取分析结果

### 健康检查

- `GET /api/health` - 服务健康状态

---

## 📄 许可证

MIT License

---

## 🙋 技术支持

如有问题，请检查：
1. Docker和Docker Compose版本是否符合要求
2. 端口是否被占用
3. 数据目录权限是否正确
4. Excel文件格式是否正确
