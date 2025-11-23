# Issue Analyzer System

基于Web的Issue分析和统计系统，支持数据持久化存储、多维度分析、数据可视化、筛选和导出功能。

## 技术架构

- **前端**: React 18 + Vite + Ant Design + ECharts + Zustand
- **后端**: Node.js 18+ + Express + Better-SQLite3
- **数据库**: SQLite 3.38+
- **部署**: Docker单容器All-in-One方案
- **构建工具**: Vite 5.x

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/          # 配置文件
│   │   ├── controllers/     # API控制器
│   │   ├── services/        # 业务逻辑服务
│   │   ├── models/          # 数据库模型
│   │   └── routes/          # API路由
│   ├── uploads/             # 临时上传文件
│   ├── logs/                # 日志文件
│   └── server.js            # 服务入口
├── frontend/                # 前端应用
│   ├── src/
│   │   ├── components/      # UI组件
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API服务
│   │   ├── store/           # 状态管理
│   │   ├── styles/          # 样式文件
│   │   └── utils/           # 工具函数
├── database/                # 数据库初始化脚本
├── data/                    # SQLite数据库文件（持久化）
├── docker/                  # Docker相关脚本
├── docker-compose.yml       # Docker编排
├── Dockerfile               # Docker镜像
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

默认运行在 `http://localhost:3000`

#### 前端应用

```bash
cd frontend
npm install
npm run dev
```

默认运行在 `http://localhost:5173`，会自动代理API请求到后端

### Docker部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 多架构支持 (AMD64/ARM64)

系统支持在AMD64和ARM64架构上运行，使用Docker Buildx构建多架构镜像：

```bash
# 构建多架构镜像
bash docker/build-multi-arch.sh
```

访问: http://localhost

### 生产环境构建

```bash
# 构建生产环境镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 核心功能

- ✅ 项目管理：上传Excel、历史项目列表、项目切换
- ✅ 多维度分析：Symptom、WF、Config失败率统计
- ✅ 数据可视化：柱状图、饼图、热力图、趋势图
- ✅ 高级筛选：日期、症状、WF、Config等多条件筛选
- ✅ 交叉分析：热力图展示多维度关联关系
- ✅ 详细数据展示：支持查看具体Issue详情
- ✅ 数据导出：Excel导出、图表导出
- ✅ 数据库持久化：SQLite存储，支持历史版本管理
- ✅ 响应式设计：适配不同屏幕尺寸
- ✅ 列选择器：自定义显示列
- ✅ 实时数据分析：动态计算统计结果

## 主要组件

### 前端组件

- **Dashboard**: 主仪表板页面，展示项目概览
- **FilterPanel**: 筛选面板，支持多条件筛选
- **DistributionCharts**: 分布图表组件，展示各种统计图表
- **CrossAnalysisHeatmap**: 交叉分析热力图
- **DetailedIssuesTable**: 详细问题表格
- **ColumnSelector**: 列选择器
- **Header**: 页面头部组件

### 页面组件

- **DashboardPage**: 仪表板页面
- **FilterResultsPage**: 筛选结果页面

## API文档

### 项目管理

- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目（上传Excel）
- `GET /api/projects/:id` - 获取项目详情
- `DELETE /api/projects/:id` - 删除项目

### 数据查询

- `GET /api/projects/:id/issues` - 获取问题列表（支持筛选）
- `GET /api/projects/:id/analysis` - 获取分析结果
- `GET /api/projects/:id/analysis/cross` - 获取交叉分析数据

### 数据导出

- `GET /api/projects/:id/export/excel` - 导出Excel
- `GET /api/projects/:id/export/chart/:type` - 导出图表

## 数据库设计

### 4张核心表

1. **projects** - 项目表
2. **issues** - 问题表
3. **sample_sizes** - 样本量表
4. **analysis_cache** - 分析缓存表

详见: `database/init.sql`

## 许可证

MIT
