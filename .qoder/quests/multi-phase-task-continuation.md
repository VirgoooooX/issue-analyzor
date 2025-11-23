# Failure Tracker Dashboard 后续阶段任务设计

## 任务背景

P0阶段已完成以下核心功能：
- ✅ SQLite数据库设计和初始化
- ✅ 后端API：项目管理、Excel上传解析
- ✅ 后端API：数据查询和分析结果
- ✅ 前端：项目选择和切换
- ✅ Symptom/WF/Config三维度失败率计算和展示
- ✅ 基础统计图表（柱状图）
- ✅ 数据表格展示（Config维度）
- ✅ Docker单容器部署方案（基础架构）

## 后续阶段任务规划

### P1阶段：高级筛选与测试项分析

#### 目标
增强数据探索能力，支持多维度筛选和测试项级别的失败率分析

#### 子任务

**1. 左侧筛选面板实现**

核心功能：
- 多维度筛选器组件开发
- 筛选条件实时预览和清除
- 筛选器状态管理

实现内容：
- 创建FilterPanel组件（左侧可折叠面板，宽度300px，支持滚动）
- 筛选器组件（按Excel表头顺序）：
  - **Open Date**：日期范围选择器（DatePicker.RangePicker）
  - **Priority**：多选下拉框（P0/P1/P2/P3等）
  - **Sample Status**：多选下拉框（动态选项）
  - **Department**：多选下拉框（部门列表）
  - **Unit#**：输入框（支持模糊搜索）
  - **SN**：输入框（支持模糊搜索）
  - **WF**：多选下拉框（带搜索功能）
  - **Config**：多选下拉框（带搜索功能）
  - **Failed Test**：多选下拉框（测试项列表）
  - **Test ID**：多选下拉框（Test1/Test2/Test3等）
  - **Failure Type**：多选下拉框（Spec./Strife）
  - **Function or Cosmetic**：多选下拉框（Function/Cosmetic）
  - **Failed Location**：多选下拉框（位置列表）
  - **Failure Symptom**：多选下拉框（带搜索功能，症状列表）
  - **FA Status**：多选下拉框（状态列表）
- 快速搜索框（置于顶部）：支持FA#全局搜索
- 已选条件标签展示（可单独删除）
- 筛选器分组（使用Collapse折叠面板）：
  - 基本信息（Open Date, Priority, FA Status）
  - 样本信息（Sample Status, Unit#, SN）
  - 测试配置（WF, Config, Failed Test, Test ID）
  - 失败分类（Failure Type, Function or Cosmetic, Failed Location）
  - 失败详情（Failure Symptom, Department）
- 应用筛选和重置按钮（固定在面板底部）

技术要点：
- 使用Ant Design的Select组件（mode="multiple"）
- DatePicker.RangePicker组件
- 状态管理：在Zustand store中添加filters模块
- 筛选条件变化时调用后端API

数据流：
- 用户选择筛选条件 → 更新filters state → 点击应用 → 调用GET /api/projects/:id/issues?filters=...
- 后端根据筛选条件构造SQL WHERE子句
- 返回筛选后的issues和重新计算的统计数据

**2. 后端筛选API增强**

API修改：`GET /api/projects/:id/issues`

新增Query参数支持：
- date_from, date_to: 日期范围（基于Open Date）
- priorities: 逗号分隔的优先级列表
- sample_statuses: 逗号分隔的Sample Status列表
- departments: 逗号分隔的部门列表
- unit_number: Unit#模糊搜索
- sn: SN模糊搜索
- wfs: 逗号分隔的WF列表
- configs: 逗号分隔的Config列表
- failed_tests: 逗号分隔的Failed Test列表
- test_ids: 逗号分隔的测试项编号列表（Test1/Test2/Test3）
- failure_types: 逗号分隔的失败类型列表（Spec./Strife）
- function_cosmetic: 逗号分隔的列表（Function/Cosmetic）
- failed_locations: 逗号分隔的失败位置列表
- symptoms: 逗号分隔的symptom列表
- fa_statuses: 逗号分隔的FA状态列表

数据库查询逻辑：
- 动态构建WHERE条件（使用参数化查询防止SQL注入）
- 示例SQL：
  ```
  SELECT * FROM issues 
  WHERE project_id = ? 
    AND (open_date BETWEEN ? AND ? OR ? IS NULL)
    AND (priority IN (?, ?, ?) OR ? IS NULL)
    AND (sample_status IN (?, ?) OR ? IS NULL)
    AND (department IN (?, ?) OR ? IS NULL)
    AND (raw_data LIKE '%"Unit#":"' || ? || '%' OR ? IS NULL)
    AND (raw_data LIKE '%"SN":"' || ? || '%' OR ? IS NULL)
    AND (wf IN (?, ?, ?) OR ? IS NULL)
    AND (config IN (?, ?) OR ? IS NULL)
    AND (failed_test IN (?, ?) OR ? IS NULL)
    AND (test_id IN (?, ?) OR ? IS NULL)
    AND (failure_type IN (?, ?) OR ? IS NULL)
    AND (function_or_cosmetic IN (?, ?) OR ? IS NULL)
    AND (failed_location IN (?, ?) OR ? IS NULL)
    AND (symptom IN (?, ?, ?) OR ? IS NULL)
    AND (fa_status IN (?, ?) OR ? IS NULL)
  ORDER BY open_date DESC
  ```

注意事项：
- Unit#和SN存储在raw_data JSON字段中，需使用LIKE或JSON函数查询
- 所有IN条件支持多选
- 日期范围可选（不选则不限制）
- 各筛选条件之间为AND关系

响应数据：
- 返回筛选后的issues列表
- 返回筛选结果的实时统计（无需缓存）

**3. 测试项维度分析功能**

后端新增API：`GET /api/projects/:id/analysis/test`

分析逻辑：
- 按WF分组，统计每个Test ID的失败率
- 计算公式：
  - 失败数 = 该WF下testId匹配的Issue数量
  - 样本数 = 该WF所有Config的Sample Size之和
  - 失败率(ppm) = (失败数 / 样本数) × 1,000,000

返回数据结构：
```
{
  "testStats": [
    {
      "wf": "WF001",
      "testId": "Test1",
      "testName": "HS 65/90/72",
      "failureCount": 3,
      "totalSamples": 500,
      "failureRate": 6000,
      "percentage": 5.2,
      "topSymptoms": [{"symptom": "Boot Fail", "count": 2}]
    }
  ]
}
```

前端展示：
- 新增"测试项失败率Top 10"柱状图
- 数据表格展示所有测试项统计
- 支持按WF筛选、按失败率排序

**4. 快速搜索功能**

实现内容：
- 筛选面板顶部添加独立搜索框
- 支持FA#精确搜索或模糊搜索
- 搜索优先级高于其他筛选器
- 实时搜索（输入防抖300ms）

后端API：修改`GET /api/projects/:id/issues`
- 新增参数：fa_search (FA#搜索关键词)
- SQL查询：
  ```
  WHERE fa_number LIKE '%' || ? || '%'
  ```

搜索说明：
- FA#搜索框独立于其他筛选器
- 输入FA编号后立即筛选
- 可与其他筛选条件组合使用

**5. 筛选器选项动态加载**

后端新增API：`GET /api/projects/:id/filter-options`

返回数据（所有选项从数据库动态提取）：
```
{
  "priorities": ["P0", "P1", "P2", "P3"],
  "sampleStatuses": ["Received", "Pending", "Testing", ...],
  "departments": ["HW", "SW", "System", "QA", ...],
  "wfs": ["WF001", "WF002", "WF003", ...],
  "configs": ["R1CASN", "R2CBCN", "R3CBCN", "R4FNSN", ...],
  "failedTests": ["HS 65/90/72", "18 Sided Drop 1m PB Sequence A", ...],
  "testIds": ["Test1", "Test2", "Test3", "Test4", ...],
  "failureTypes": ["Spec.", "Strife"],
  "functionCosmetic": ["Function", "Cosmetic"],
  "failedLocations": ["Screen", "Battery", "Camera", ...],
  "symptoms": ["Boot Fail", "Display Issue", "Camera Fail", ...],
  "faStatuses": ["Open", "Closed", "In Progress", "On Hold", ...]
}
```

数据提取逻辑：
- 从issues表中使用DISTINCT查询所有唯一值
- 排除NULL和空字符串
- 按字母或数字排序
- Sample Status、Department等从raw_data JSON字段提取

前端实现：
- Dashboard挂载时加载筛选器选项
- 存储到store中
- 动态生成Select组件的options

#### 验收标准
- 筛选面板可正常展开/折叠
- 所有筛选器可正确筛选数据
- 筛选后图表和统计卡片实时更新
- 测试项维度分析图表正常显示
- 搜索功能实时响应且结果准确
- 筛选性能：API响应时间 < 500ms

---

### P2阶段：详细数据表格与交叉分析

#### 目标
提供详细的原始数据展示和多维度交叉分析能力

#### 子任务

**1. 详细数据表格组件**

实现内容：
- 在Dashboard底部添加详细数据表格区（高度400px）
- 展示筛选后的原始Issue数据

表格功能：
- 分页（每页50条，支持页码和页大小调整）
- 列排序（支持多列排序）
- 列显示/隐藏配置（用户可选择显示哪些列）
- 单行可展开查看完整详情（包括raw_data中的所有字段）
- 表格顶部显示当前筛选结果总数

显示列：
- FA#, Open Date, WF, Config, Symptom, Failed Test, Test ID
- Priority, Failure Type, Root Cause, FA Status, Department, Owner
- 操作列：展开详情按钮

技术要点：
- 使用Ant Design Table组件
- expandable属性实现行展开
- Column Selector实现列配置
- pagination属性配置分页
- sorter属性配置排序

后端API：已有`GET /api/projects/:id/issues`
- 增强分页和排序参数
- sort_by: 排序字段
- sort_order: asc/desc

**2. 交叉分析矩阵（Symptom × Config）**

后端新增API：`GET /api/projects/:id/analysis/cross`

Query参数：
- dimension1: 第一维度（symptom/wf/config）
- dimension2: 第二维度
- filters: JSON格式筛选条件

分析逻辑：
- 统计两个维度的交叉组合出现次数
- 计算每个组合的失败率

返回数据：
```
{
  "crossAnalysis": {
    "dimension1": "symptom",
    "dimension2": "config",
    "matrix": [
      {
        "symptom": "Boot Fail",
        "config": "R1CASN",
        "count": 15,
        "percentage": 8.5,
        "failureRate": 12500
      }
    ]
  }
}
```

前端展示：
- ECharts热力图组件
- X轴：Symptom，Y轴：Config
- 颜色深浅表示失败数量
- 悬浮显示详细数值
- 点击单元格可钻取到详细Issue列表

**3. WF × Symptom热力图**

实现内容：
- 复用交叉分析API（dimension1=wf, dimension2=symptom）
- 热力图展示WF和Symptom的关联关系
- 识别高风险组合

图表配置：
- 使用ECharts heatmap类型
- visualMap组件控制颜色映射
- tooltip显示详细统计

**4. Failure Type和Function vs Cosmetic分布图**

后端新增统计：在`GET /api/projects/:id/analysis`中增加
```
{
  "failureTypeStats": [
    {"type": "Spec.", "count": 85, "percentage": 54.5},
    {"type": "Strife", "count": 71, "percentage": 45.5}
  ],
  "functionCosmeticStats": [
    {"category": "Function", "count": 120, "percentage": 76.9},
    {"category": "Cosmetic", "count": 36, "percentage": 23.1}
  ]
}
```

前端展示：
- 饼图展示Failure Type分布
- 饼图展示Function vs Cosmetic分布
- 使用ECharts pie类型

**5. 数据钻取功能**

交互逻辑：
- 点击图表中的某个数据点（如某个WF的柱子）
- 自动应用该维度的筛选条件
- 表格自动滚动到视图并展示筛选结果
- 面包屑导航显示当前钻取路径

实现要点：
- 图表onClick事件处理
- 更新filters state
- 触发数据刷新
- UI反馈（高亮、动画）

#### 验收标准
- 详细数据表格正常显示并支持所有功能
- 热力图正确展示交叉分析数据
- 饼图正常显示分布统计
- 数据钻取流程流畅，筛选准确
- 表格性能：1000条数据流畅渲染

---

### P3阶段：时间趋势分析与导出功能

#### 目标
提供时间维度的趋势分析和完整的数据导出能力

#### 子任务

**1. 时间趋势分析**

后端新增API：`GET /api/projects/:id/analysis/trend`

Query参数：
- granularity: 时间粒度（day/week/month）
- date_from, date_to: 时间范围
- group_by: 分组维度（symptom/wf/config）
- filters: 其他筛选条件

分析逻辑：
- 按Open Date分组统计Failure数量
- 支持按周、月聚合
- 计算移动平均（可选）

返回数据：
```
{
  "trendData": [
    {
      "date": "2024-10-01",
      "count": 12,
      "movingAvg": 10.5
    }
  ],
  "trendByDimension": {
    "Boot Fail": [
      {"date": "2024-10-01", "count": 5}
    ]
  }
}
```

前端展示：
- 时间趋势折线图（ECharts line类型）
- 支持时间范围选择
- 支持切换时间粒度
- 支持叠加多个维度对比
- 图例可点击切换显示

**2. 趋势识别**

算法实现：
- 简单线性回归判断趋势方向
- 识别异常峰值（超过均值+2倍标准差）
- 标注趋势（上升/下降/平稳）

前端展示：
- 趋势线叠加在原始数据上
- 异常点用特殊标记
- 趋势说明文字

**3. Excel导出功能**

后端新增API：`GET /api/projects/:id/export/excel`

Query参数：
- filters: 筛选条件
- include_sheets: 要导出的Sheet列表

导出内容（多个Sheet）：
- Sheet1: 概览统计
- Sheet2: Symptom维度统计
- Sheet3: WF维度统计
- Sheet4: Config维度统计
- Sheet5: 测试项维度统计
- Sheet6: 交叉分析数据
- Sheet7: 筛选后的原始数据

实现技术：
- 使用SheetJS (xlsx)库
- 后端生成Excel工作簿
- 应用样式：表头加粗、条件格式、自动列宽
- 数值格式化：百分比、千分位

响应处理：
- Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- Content-Disposition: attachment; filename="analysis_report.xlsx"

前端实现：
- 顶部导航栏添加"导出Excel"按钮
- 点击按钮弹出导出选项对话框
- 用户选择要导出的Sheet
- 下载文件

**4. 图表导出功能**

实现内容：
- 每个图表右上角添加导出按钮
- 支持导出为PNG或SVG格式

技术方案：
- 使用ECharts的getDataURL方法获取图片
- 前端直接生成下载链接
- 无需后端支持

导出选项：
- 单个图表独立导出
- 所有图表批量导出（打包为ZIP）

实现步骤：
- 获取ECharts实例的dataURL
- 创建a标签触发下载
- 批量导出使用JSZip库打包

**5. 数据预览和验证报告**

前端展示优化：
- 项目上传成功后显示验证报告弹窗
- 展示解析统计：总Issues数、Config数量、测试项数量
- 警告列表：Config不匹配、Test不匹配、WF缺失Sample Size
- 详细信息可展开查看

ValidationReport组件：
- Modal弹窗展示
- 使用Collapse组件展示警告详情
- Tag组件标注警告级别（warning/error）
- 提供"下载验证报告"按钮（导出为JSON或TXT）

#### 验收标准
- 时间趋势图正确显示数据走势
- 趋势识别准确
- Excel导出文件格式正确，数据完整
- 图表导出功能正常，图片清晰
- 验证报告展示友好，信息完整

---

### P4阶段：高级交互与用户体验优化

#### 目标
提升交互体验、响应式设计和性能优化

#### 子任务

**1. 响应式布局实现**

布局断点策略：
- ≥1920px: 完整四栏布局（筛选面板+主内容+对比面板）
- 1440-1919px: 主内容图表2列，保留筛选面板
- 1024-1439px: 隐藏对比面板，筛选面板可折叠
- <1024px: 单列布局，筛选面板改为抽屉式

实现技术：
- CSS媒体查询
- Ant Design Grid系统（Col的responsive属性）
- Drawer组件实现移动端筛选面板

调整内容：
- 图表网格自动调整列数
- 统计卡片自适应换行
- 表格支持横向滚动（小屏）

**2. 加载状态与空状态优化**

加载状态：
- Excel上传解析：Progress进度条 + 解析步骤文字
- 项目切换：Skeleton骨架屏占位
- 数据筛选：局部Spin遮罩
- 导出生成：Modal进度提示

空状态设计：
- 无项目：Empty组件 + 上传引导按钮
- 筛选无结果：Empty提示 + 重置筛选按钮
- 图表无数据：Empty占位

错误处理：
- 全局错误边界（ErrorBoundary组件）
- 网络错误：Message提示 + 重试按钮
- 解析错误：详细错误信息展示

**3. 性能优化实现**

前端优化：
- 图表组件使用React.memo包装
- 大数据表格使用虚拟滚动（react-window）
- 筛选器变化添加防抖处理（300ms）
- 图表懒加载（Intersection Observer）
- 使用useMemo缓存计算结果

后端优化：
- 数据库索引优化（已在初始设计中完成）
- API响应缓存（analysis_cache表）
- 批量查询优化
- 大数据分页加载

**4. 用户偏好设置**

实现内容：
- 保存用户的筛选器配置（localStorage）
- 保存图表显示偏好
- 保存表格列显示配置
- 保存页面布局偏好（面板展开/折叠）

设置面板：
- 顶部导航栏添加设置按钮
- Modal弹窗展示设置选项
- 即时生效

**5. 快捷键支持**

快捷键列表：
- Ctrl/Cmd + K: 聚焦搜索框
- Ctrl/Cmd + E: 打开导出对话框
- Ctrl/Cmd + R: 重置筛选
- Ctrl/Cmd + /: 显示快捷键帮助

实现技术：
- 使用react-hotkeys-hook库
- 全局快捷键监听
- 快捷键冲突处理

**6. 数据对比面板（右侧）**

实现内容：
- 右侧可选显示对比面板（宽度320px）
- 对比模式选择：维度对比/时间对比
- 对比项选择器（最多3个）
- 对比结果并排柱状图展示
- 差异分析文字说明

对比逻辑：
- 维度对比：选择多个WF/Config进行失败率对比
- 时间对比：选择不同时间段的数据对比
- 调用现有分析API，前端组合数据

交互：
- 点击图表中的项自动加入对比
- 对比面板可拖拽调整宽度
- 对比结果可导出

#### 验收标准
- 响应式布局在各尺寸屏幕正常显示
- 加载状态和空状态体验良好
- 性能指标达标：筛选响应<300ms，图表渲染<1s
- 用户设置可正常保存和恢复
- 快捷键功能正常
- 对比面板交互流畅

---

### P5阶段：Docker部署完善与文档

#### 目标
完善Docker部署方案、监控、文档和测试

#### 子任务

**1. Docker配置完善**

优化内容：
- 完善Dockerfile多阶段构建
- 优化镜像大小（使用alpine基础镜像）
- 配置Nginx gzip压缩
- 配置Nginx缓存策略
- 增加健康检查
- 配置日志轮转

docker-compose.yml增强：
- 添加资源限制（memory, cpu）
- 配置重启策略
- 增加环境变量配置
- 配置volumes持久化

**2. nginx.conf优化**

增强配置：
- 启用gzip压缩（text/css, application/json等）
- 静态资源缓存头（Cache-Control）
- 增加安全头（X-Content-Type-Options, X-Frame-Options）
- 配置请求大小限制（client_max_body_size: 50MB）
- 增加超时配置（proxy_read_timeout: 300s）

**3. 数据库备份和恢复工具**

备份脚本：backup.sh
```
#!/bin/bash
BACKUP_DIR="./backups"
DB_FILE="./data/failure_tracker.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.db"

mkdir -p $BACKUP_DIR
sqlite3 $DB_FILE ".backup $BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# 保留最近7天的备份
find $BACKUP_DIR -name "backup_*.db" -mtime +7 -delete
```

恢复脚本：restore.sh
```
#!/bin/bash
BACKUP_FILE=$1
DB_FILE="./data/failure_tracker.db"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

docker-compose down
cp $BACKUP_FILE $DB_FILE
docker-compose up -d
echo "Database restored from: $BACKUP_FILE"
```

定时备份：
- 使用cron配置每日自动备份
- 备份文件压缩存储
- 异地备份建议

**4. 监控和日志**

日志配置：
- 后端使用Winston日志库
- 配置日志级别（error, warn, info, debug）
- 日志文件分割（按日期或大小）
- Nginx访问日志和错误日志

监控指标：
- Docker容器状态监控
- 数据库文件大小监控
- API响应时间监控
- 内存和CPU使用率

健康检查端点：
- GET /api/health
- 返回数据库连接状态、磁盘空间、内存使用

**5. 部署文档完善**

DEPLOYMENT.md内容：
- 系统要求
- 初次部署步骤（详细）
- 更新部署流程
- 数据备份和恢复
- 常见问题排查
- 性能调优建议
- 安全配置建议

API文档：
- 使用Swagger/OpenAPI规范
- 自动生成API文档界面
- 包含所有接口的请求/响应示例
- 错误码说明

用户手册：
- 功能使用说明（配截图）
- 数据导入指南
- 筛选和分析教程
- 导出功能说明
- 常见问题FAQ

**6. 测试和验证**

测试内容：
- Excel解析测试（多种格式、边界情况）
- API接口测试（Postman集合）
- 前端功能测试（关键流程）
- 性能测试（大数据量场景）
- 浏览器兼容性测试

性能基准测试：
- 10MB Excel文件解析时间
- 1000条Issue的筛选响应时间
- 图表渲染时间
- 并发上传测试

Bug修复清单：
- 记录已知问题
- 修复优先级排序
- 测试验证

#### 验收标准
- Docker镜像大小优化至 < 500MB
- Nginx配置完善，压缩率 > 70%
- 备份脚本正常运行，可成功恢复
- 日志记录完整，便于排查问题
- 部署文档清晰，新用户可独立部署
- 所有测试用例通过

---

## 各阶段工作量估算

| 阶段 | 预计工作日 | 主要工作内容 |
|------|-----------|-------------|
| P1阶段 | 3-4天 | 筛选面板、测试项分析、搜索功能 |
| P2阶段 | 3-4天 | 详细表格、交叉分析、热力图 |
| P3阶段 | 3-4天 | 趋势分析、Excel导出、图表导出 |
| P4阶段 | 4-5天 | 响应式布局、性能优化、用户体验 |
| P5阶段 | 2-3天 | Docker完善、文档、测试 |
| **总计** | **15-20天** | **完整功能实现和优化** |

## 开发建议

### 技术债务管理
- 每个阶段完成后进行代码审查
- 重构重复代码，提取公共组件
- 完善单元测试覆盖率
- 更新技术文档

### 迭代优化
- 每阶段完成后收集用户反馈
- 根据实际使用情况调整优先级
- 关注性能瓶颈并及时优化

### 质量保证
- 代码提交前进行Lint检查
- 关键功能编写E2E测试
- 定期进行性能基准测试
- 安全扫描和漏洞修复

## 扩展性预留

当前设计已考虑未来扩展：

**数据源扩展**：
- CSV格式导入（后端增加CSV解析器）
- API数据源接入（增加数据同步服务）
- 增量数据更新（支持追加到现有项目）

**功能扩展**：
- 用户权限管理（增加users表和角色系统）
- 自定义字段映射（支持不同Excel格式）
- 阈值告警配置（失败率超标自动通知）
- 多项目数据对比（跨项目趋势分析）

**架构扩展**：
- 数据库迁移到PostgreSQL（大数据量场景）
- 微服务拆分（解析服务、计算服务独立）
- 消息队列（异步任务处理）
- Redis缓存（提升查询性能）

## 成功标准

完成所有后续阶段后，系统应满足：

**功能完整性**：
- ✅ 支持多维度数据筛选和探索
- ✅ 提供丰富的可视化图表
- ✅ 支持详细数据查看和导出
- ✅ 提供时间趋势分析
- ✅ 支持交叉维度分析

**性能指标**：
- Excel解析（10MB）< 5秒
- 筛选响应 < 300ms
- 图表渲染 < 1秒
- 项目切换 < 1秒

**用户体验**：
- 界面友好，学习成本低
- 响应式布局支持各种屏幕
- 加载状态和错误提示完善
- 支持快捷键操作

**部署运维**：
- Docker一键部署
- 自动备份机制
- 日志完整便于排查
- 文档清晰易懂
