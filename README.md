# Issue Analyzer System

基于Web的Issue分析和统计系统，支持数据持久化存储、多维度分析、数据可视化、筛选和导出功能。

## 技术架构

- **前端**: React 18 + Vite 5 + Ant Design 5 + ECharts 5 + Zustand
- **后端**: Node.js 18+ + Express 4 + Better-SQLite3
- **数据库**: SQLite 3.38+
- **可视化**: Canvas（PDF导出）+ ECharts（交互图表）
- **部署**: Docker多架构支持（AMD64/ARM64）+ Nginx反向代理
- **构建工具**: Vite 5.x + Docker Buildx

## 项目结构

```
.
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── config/          # 配置文件
│   │   ├── controllers/     # API控制器
│   │   ├── services/        # 业务逻辑服务
│   │   │   ├── analysisService.js     # 数据分析逻辑
│   │   │   ├── cacheService.js        # LRU缓存管理
│   │   │   ├── excelParser.js         # Excel解析
│   │   │   └── exportService.js       # Excel/PDF导出
│   │   ├── models/          # 数据库模型
│   │   ├── routes/          # API路由
│   │   └── database.js      # 数据库连接
│   ├── uploads/             # 临时上传文件
│   ├── logs/                # 日志文件
│   └── server.js            # 服务入口
├── frontend/                # 前端应用
│   ├── src/
│   │   ├── components/      # UI组件
│   │   │   ├── Dashboard.jsx           # 主仪表板
│   │   │   ├── DistributionCharts.jsx  # 分布图表
│   │   │   ├── CrossAnalysisHeatmap.jsx # 交叉热力图
│   │   │   ├── FilterPanel.jsx         # 筛选面板
│   │   │   ├── DetailedIssuesTable.jsx # 详情表格
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API服务
│   │   ├── store/           # Zustand状态管理
│   │   ├── styles/          # 样式文件
│   │   └── utils/           # 工具函数
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── database/                # 数据库初始化脚本
│   └── init.sql
├── docker/                  # Docker脚本
│   ├── build-multi-arch.sh  # 多架构构建脚本
│   ├── nginx.conf           # Nginx配置
│   └── start.sh             # 启动脚本
├── data/                    # SQLite数据库文件（持久化）
├── docker-compose.yml       # Docker编排
├── Dockerfile               # Docker镜像定义
├── DEPLOYMENT.md            # 部署文档
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

访问: http://localhost

### 多架构支持 (AMD64/ARM64)

系统支持在AMD64和ARM64架构上运行，使用Docker Buildx构建多架构镜像：

```bash
# 构建多架构镜像
bash docker/build-multi-arch.sh
```

## 核心功能

### 数据管理
- ✅ **项目管理**：Excel上传、版本管理、历史项目列表、一键切换
- ✅ **数据持久化**：SQLite数据库、自动备份、支持历史版本
- ✅ **数据导入**：支持Excel/CSV格式解析，智能数据验证

### 数据分析与可视化
- ✅ **多维度分析**：Symptom、WF、Config、Failed Test、Failed Location等6大维度
- ✅ **失败率统计**：
  - Spec失败率 (F/T)
  - Strife失败率 (SF/T)
  - 总失败率 (F+SF/T)
- ✅ **交互式仪表板**：
  - Top 10分布柱状图（Symptom、WF、Test）
  - FA Status圆环图
  - 动态数据更新
- ✅ **交叉分析热力图**：
  - 支持任意两个维度的交叉分析
  - 热力背景色区分数据浓度
  - 实时钻取数据详情
  - 智能颜色映射（F/SF/Total三种模式）

### 筛选与查询
- ✅ **高级筛选面板**：
  - 多条件组合筛选（支持与/或逻辑）
  - 下拉复选框展开状态保持
  - Failed Location、Symptom、WF、Config等维度
- ✅ **实时数据更新**：动态计算统计结果
- ✅ **详细数据展示**：Issue表格、Filter Results页面

### 数据导出
- ✅ **Excel报告导出**：
  - 多工作表组织（统计概览、Symptom、WF、Config、Test、Issue明细）
  - 完整分析数据
  - 筛选条件记录
- ✅ **PDF报告导出**：
  - 项目概览和统计摘要
  - Top 10分析结果可视化
  - Canvas渲染图表
  - 适合打印和分享

### UI/UX体验
- ✅ **响应式设计**：适配不同屏幕尺寸
- ✅ **列选择器**：自定义表格显示列（16列固定）
- ✅ **页面持久化**：刷新后状态保持
- ✅ **看板跳转**：仪表板直接钻取到筛选结果
- ✅ **交互反馈**：悬停提示、加载状态、成功提示

## 主要组件

### 前端组件架构

| 组件 | 功能描述 | 依赖 |
|------|--------|------|
| **Dashboard** | 主仪表板页面，展示Top 10分析和FA Status | ECharts, Ant Design |
| **DistributionCharts** | 分布图表组件，展示柱状图和圆环图 | ECharts, ReactECharts |
| **CrossAnalysisHeatmap** | 交叉分析热力图，支持多维度分析 | HTML Table, CSS |
| **FilterPanel** | 筛选面板，支持多条件组合筛选 | Ant Design Select |
| **DetailedIssuesTable** | 详细问题表格，展示Issue列表 | Ant Design Table |
| **ColumnSelector** | 列选择器，自定义表格显示列 | Ant Design Modal |
| **Header** | 页面头部，项目选择和导出功能 | Ant Design Menu |
| **FailureRateMatrix** | 失败率矩阵（可选），Spec/Strife统计 | ECharts |

### 页面组件

| 页面 | 路径 | 功能 |
|------|------|------|
| **DashboardPage** | `/` | 主仪表板，数据概览 |
| **FilterResultsPage** | `/filter-results` | 筛选结果详情页 |

## API文档

### 项目管理接口

```
GET    /api/projects                    # 获取项目列表
POST   /api/projects                    # 创建项目（上传Excel）
GET    /api/projects/:id                # 获取项目详情
DELETE /api/projects/:id                # 删除项目
GET    /api/projects/:id/export-status  # 查询导出状态
```

### 数据查询接口

```
GET /api/projects/:id/issues           # 获取问题列表（支持筛选）
  ├─ Query Params:
  │  ├─ failed_locations[]: 失败位置
  │  ├─ symptoms[]: 症状
  │  ├─ wfs[]: WF
  │  ├─ configs[]: Config
  │  ├─ failed_tests[]: 失败测试
  │  └─ limit: 返回数量
  └─ Response: Issues数组，包含SN去重

GET /api/projects/:id/analysis         # 获取分析结果
  ├─ Query Params: 同上筛选参数
  └─ Response: Symptom/WF/Config维度统计

GET /api/projects/:id/analysis/cross   # 获取交叉分析数据
  ├─ Query Params:
  │  ├─ dimension1: 维度1 (symptom/config/wf/failed_test/failed_location)
  │  ├─ dimension2: 维度2
  │  └─ 其他筛选参数
  └─ Response: 矩阵数据 + 失败率统计
```

### 数据导出接口

```
GET  /api/projects/:id/export/excel    # 导出Excel报告（不含图表）
  └─ Response: .xlsx文件流

POST /api/projects/:id/export/pdf      # 导出PDF报告（含图表）
  ├─ Body: { chartImages: {...} }      # 可选的chart截图
  └─ Response: .pdf文件流
```

### 导出功能详解

**Excel报告**：
- 工作表1：统计概览（项目信息、筛选条件、汇总数据）
- 工作表2：Symptom分析（失败数、失败率排序）
- 工作表3：WF分析
- 工作表4：Config分析
- 工作表5：Test分析
- 工作表N：Issue明细表

**PDF报告**：
- 第1页：项目概览和统计摘要
- 第2页：Top 10 Symptom/WF/Config（柱状图）
- 第3+页：详细分析数据表
- 支持Canvas渲染图表和自定义布局

## 数据库设计

### 核心表结构

```sql
-- 项目表：存储上传的项目信息
CREATE TABLE projects {
  id STRING PRIMARY KEY,
  name STRING,           -- 项目名称
  file_name STRING,      -- 原始文件名
  upload_time DATETIME,  -- 上传时间
  row_count INTEGER      -- 数据行数
}

-- 问题表：存储解析后的Issue数据
CREATE TABLE issues {
  id STRING PRIMARY KEY,
  project_id STRING,
  sn STRING,             -- Serial Number（去重标识）
  failed_location STRING,
  symptom STRING,
  wf STRING,
  config STRING,
  failed_test STRING,
  test_id STRING,        -- 测试项ID
  failure_type STRING,   -- F(Spec失败) / SF(Strife失败) / BOTH
  FOREIGN KEY (project_id) REFERENCES projects(id)
}

-- 样本量表：存储每个维度的总样本数
CREATE TABLE sample_sizes {
  id STRING PRIMARY KEY,
  project_id STRING,
  dimension STRING,      -- 维度名称
  dimension_value STRING,-- 维度值
  total_samples INTEGER, -- 总样本数(T)
  FOREIGN KEY (project_id) REFERENCES projects(id)
}

-- 分析缓存表：缓存计算结果，加速查询
CREATE TABLE analysis_cache {
  id STRING PRIMARY KEY,
  project_id STRING,
  cache_key STRING,      -- 缓存键（维度+筛选条件）
  cache_data JSON,       -- 缓存数据
  updated_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects(id)
}
```

### 关键算法

**Failure Rate计算**：
```
Spec失败率 (F/T) = Σ(specCount) / totalSamples
Strife失败率 (SF/T) = Σ(strifeCount) / totalSamples
总失败率 = (Σ specCount + Σ strifeCount) / totalSamples
```

**SN去重规则**：
- 按SN (Serial Number)去重
- 同一SN在多个WF/Config中出现只计算一次
- 失败类型标识：
  - F: 仅Spec失败
  - SF: 仅Strife失败
  - BOTH: 既是Spec又是Strife失败

**交叉分析数据结构**：
```javascript
{
  matrix: [
    {
      dimension1Value: "症状1",
      dimension2Value: "WF1",
      specCount: 5,        // 该交叉点的F数量
      strifeCount: 3,      // 该交叉点的SF数量
      totalCount: 8,       // F + SF总和
      totalSamples: 100,   // 样本总数
      specFailureRate: "5F/100T",
      strifeFailureRate: "3SF/100T",
      totalFailureRate: "8F/100T",
      percentage: "8.00%"
    }
  ],
  dimension1Values: ["症状1", "症状2"],
  dimension2Values: ["WF1", "WF2"]
}
```

## 配置与环境

### 环境变量配置

```bash
# backend/.env
NODE_ENV=development      # 运行环境
PORT=3000                # 后端服务端口
DB_PATH=./data/db.sqlite # 数据库路径
UPLOAD_DIR=./uploads     # 上传文件目录
LOG_DIR=./logs           # 日志目录
```

### 构建与部署配置

**Dockerfile特性**：
- Alpine Linux基础镜像（轻量级）
- Node.js 18LTS + Canvas依赖预装
- 前端Vite构建产物集成
- Nginx反向代理配置
- 多阶段构建优化

**Docker Compose编排**：
- 单容器All-in-One部署
- 数据卷挂载持久化（data/）
- 自动端口映射（:80）
- 环境变量自动配置

**多架构构建**：
- 支持AMD64和ARM64
- 使用Docker Buildx跨平台编译
- 自动推送到镜像仓库

### 性能优化

- **缓存策略**：LRU缓存分析结果（避免重复计算）
- **数据去重**：SN级别的智能去重
- **增量更新**：仅计算必要的维度数据
- **Lazy Loading**：交叉分析数据按需加载

## 开发指南

### 代码规范

**后端**：
- Express中间件模式
- Service + Model分层架构
- 错误处理统一化
- 数据验证用Joi

**前端**：
- React Hooks + Zustand状态管理
- Ant Design 5组件库
- 响应式CSS Grid布局
- ECharts自定义配置

### 常见问题

**Q: Canvas模块在Alpine Linux中编译失败？**
A: 确保Dockerfile中包含build-base和python依赖，参见：`docker/Dockerfile`

**Q: PDF导出文件太大？**
A: 减少图表分辨率，参见：`backend/src/services/exportService.js`

**Q: 数据同步不及时？**
A: 检查缓存过期时间，参见：`backend/src/services/cacheService.js`

**Q: WF表关联测试范围有限制？**
A: 仅关联当前项目中实际出现的测试，参见：`development_practice_specification`

**Q: 表格显示列数有限制吗？**
A: 是的，固定为16列，参见：`project_configuration`

## 许可证与贡献

MIT License

**贡献指南**：
1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

**版本历史**：
- **v1.0.0** (2025-11-27): 初始版本
  - 完整的数据管理和分析功能
  - Excel/PDF导出
  - 交叉分析热力图
  - 多架构Docker支持
