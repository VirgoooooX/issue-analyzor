# Failure Tracker Dashboard

基于Web的Failure Tracker分析和统计Dashboard，支持数据持久化存储、多维度分析、数据可视化、筛选和导出功能。

## 技术架构

- **前端**: React 18 + Vite + Ant Design + ECharts
- **后端**: Node.js 18+ + Express
- **数据库**: SQLite 3.38+
- **部署**: Docker单容器All-in-One方案

## 项目结构

```
.
├── backend/                # 后端服务
│   ├── src/
│   │   ├── config/        # 配置文件
│   │   ├── controllers/   # API控制器
│   │   ├── services/      # 业务逻辑服务
│   │   ├── models/        # 数据库模型
│   │   ├── middlewares/   # 中间件
│   │   └── utils/         # 工具函数
│   ├── uploads/           # 临时上传文件
│   ├── logs/              # 日志文件
│   └── server.js          # 服务入口
├── frontend/              # 前端应用
├── database/              # 数据库初始化脚本
├── data/                  # SQLite数据库文件（持久化）
├── docker-compose.yml     # Docker编排
├── Dockerfile             # Docker镜像
└── README.md
```

## 快速开始

### 本地开发

#### 后端服务

```bash
cd backend
npm install
npm run dev
```

#### 前端应用

```bash
cd frontend
npm install
npm run dev
```

### Docker部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问: http://localhost

## 核心功能

- ✅ 项目管理：上传Excel、历史项目列表、项目切换
- ✅ 多维度分析：Symptom、WF、Config失败率统计
- ✅ 数据可视化：柱状图、饼图、热力图、趋势图
- ✅ 高级筛选：日期、症状、WF、Config等多条件筛选
- ✅ 数据导出：Excel导出、图表导出
- ✅ 数据库持久化：SQLite存储，支持历史版本管理

## API文档

### 项目管理

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目（上传Excel）
- `GET /api/projects/:id` - 获取项目详情
- `DELETE /api/projects/:id` - 删除项目

### 数据查询

- `GET /api/projects/:id/issues` - 获取问题列表（支持筛选）
- `GET /api/projects/:id/analysis` - 获取分析结果

### 数据导出

- `GET /api/projects/:id/export/excel` - 导出Excel

## 数据库设计

### 4张核心表

1. **projects** - 项目表
2. **issues** - 问题表
3. **sample_sizes** - 样本量表
4. **analysis_cache** - 分析缓存表

详见: `database/init.sql`

## 许可证

MIT
