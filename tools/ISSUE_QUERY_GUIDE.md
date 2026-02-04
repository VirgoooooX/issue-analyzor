# issue_query.py 使用说明（云端只读查询 CLI）

本工具用于在本地通过 HTTP API 远程查询云端（或本机）Issue Analyzor 服务端的数据，支持：
- 自动登录（用户名/密码）获取 JWT
- 自动选择项目快照（project_id 优先，否则按 project_key/phase/name 选择最新 upload_time）
- 支持服务端已实现的全部 filters（并提供 `describe` 输出清单，方便后续扩展）
- 以 table/json/csv 输出结果，便于脚本二次处理或直接复制到报告

脚本路径：
- [issue_query.py](file:///l:/Web/Issue%20Analyzor/tools/issue_query.py)

---

## 1. 前置条件

### 1.1 Python
- 本地需要 Python 3（脚本只用标准库，不依赖第三方包）。

### 1.2 服务端可访问
- 你需要一个可访问的服务端地址（本机/内网/公网均可），例如：
  - 本地：`http://localhost:3000`
  - 云端：`https://your-domain.com`
- 服务端启用了鉴权后，除 `/api/auth/*` 外的 `/api/projects/*` 都需要 token。

---

## 2. 鉴权（推荐做法）

脚本支持两种输入用户名密码的方式：

### 2.1 命令行参数（最直接）
每条命令都可以带：
- `--username admin --password password123`

### 2.2 环境变量（更省事，也避免命令行泄露密码）
设置环境变量后，可以不再写 `--username/--password`：
- `ISSUE_ANALYZOR_USERNAME`
- `ISSUE_ANALYZOR_PASSWORD`

Windows PowerShell 示例：

```powershell
$env:ISSUE_ANALYZOR_USERNAME="admin"
$env:ISSUE_ANALYZOR_PASSWORD="password123"
```

---

## 3. 一条命令的基本结构

```bash
python tools/issue_query.py <子命令> --base <服务端地址> [鉴权参数] [项目选择参数] [filters] [输出参数]
```

常用项：
- `--base`：服务端地址（默认 `http://localhost:3000`）
- `--username/--password`：自动登录（或用环境变量）
- `--project_id` 或 `--project_key/--phase/--project_name`：选择项目快照
- `--format table|json|csv`：输出格式（默认 table）

---

## 4. 项目选择规则（非常重要）

很多接口都需要 `project_id`。为了避免你每次先查 projects 再手动抄 id，脚本内置了“自动选择”逻辑：

优先级如下：
1. `--project_id`：直接指定（最高优先级）
2. 否则按筛选条件缩小候选集：
   - `--project_key`
   - `--phase`
   - `--project_name`（按 name 模糊包含匹配）
3. 在候选集中选择“最新快照”：
   - 以 `upload_time` 最大为准；若相同，再比较 `id` 最大

你可以先用 `projects` 看看有哪些快照：

```bash
python tools/issue_query.py projects --base http://localhost:3000 --format table
```

---

## 5. filters 参数（支持全量；如何查看清单）

filters 的含义与前端筛选面板一致，最终由后端 `/api/projects/:id/issues` 与 `/api/projects/:id/filter-statistics` 等接口解析。

### 5.1 查看脚本收录的“全量 filters 参数”

```bash
python tools/issue_query.py describe
```

输出 JSON 中包含：
- `filter_parameters`：脚本内置参数清单（类型、示例、说明）
- `query_methods`：子命令清单（对应哪个 API）
- `stats_kinds`：可提取的分布类型（用于 `stats --kind ...`）

### 5.2 透传未知参数（为后期扩展预留）

如果服务端新增了某个 query 参数，但脚本还没加对应 flag，你仍然可以直接透传：

```bash
python tools/issue_query.py filter-stats --filter key=value --filter other_key=123 ...
```

---

## 6. 子命令与对应查询方法（建议先记住这几个）

### 6.1 projects：列出上传快照

```bash
python tools/issue_query.py projects --base http://localhost:3000 --format table
```

支持筛选：
- `--project_key`
- `--phase`
- `--name`（模糊匹配）

### 6.2 sample-sizes：WF/Test/Config 样本量

```bash
python tools/issue_query.py sample-sizes --base http://localhost:3000 --project_key M60 --phase P1
```

### 6.3 filter-stats：调用 /filter-statistics 原样输出（调试最有用）

```bash
python tools/issue_query.py filter-stats --base http://localhost:3000 --project_key M60 --phase P1 --symptoms "Rattle lv3"
```

### 6.4 stats：从 /filter-statistics 提取某个分布并格式化输出（日常最常用）

可选 `--kind`：
- `symptom`
- `wf`
- `config`
- `failed_test`
- `failed_location`
- `failure_type`
- `function_cosmetic`
- `fa_status`

示例：查 M60 P1 里 Failed Location=ISB 的条数：

```bash
python tools/issue_query.py stats --base http://localhost:3000 --project_key M60 --phase P1 --kind failed_location --match ISB
```

示例：查某症状下各 config 的分布（数量/Spec/Strife/SN 去重计数等）：

```bash
python tools/issue_query.py stats --base http://localhost:3000 --project_key M60 --phase P1 --kind config --symptoms "Rattle lv3"
```

示例：只查 ISB 子集下的 config 分布：

```bash
python tools/issue_query.py stats --base http://localhost:3000 --project_key M60 --phase P1 --kind config --failed_locations ISB
```

格式与裁剪：
- `--format json|csv|table`
- `--top 20`
- `--match xxx`（按关键字段模糊过滤）
- `--order_by totalCount --order_dir desc`（排序）
- `--columns col1,col2,...`（自定义输出列）

### 6.5 analysis：获取 overview + 多维统计（FR 口径）

```bash
python tools/issue_query.py analysis --base http://localhost:3000 --project_key M60 --phase P1 --symptoms "Rattle lv3"
```

### 6.6 analysis-test：获取 Test 维度分析

```bash
python tools/issue_query.py analysis-test --base http://localhost:3000 --project_key M60 --phase P1
```

### 6.7 cross：维度×维度交叉分析

```bash
python tools/issue_query.py cross --base http://localhost:3000 --project_key M60 --phase P1 --dimension1 wf --dimension2 symptom
```

### 6.8 issues：分页拉取明细（需要时用于自定义聚合）

```bash
python tools/issue_query.py issues --base http://localhost:3000 --project_key M60 --phase P1 --page 1 --limit 100
```

### 6.9 filter-options：联动下拉可选值（用于“探索式查数”）

```bash
python tools/issue_query.py filter-options --base http://localhost:3000 --project_key M60 --phase P1 --wfs 1
```

### 6.10 failure-matrix：WF×Test×Config 失败率矩阵

```bash
python tools/issue_query.py failure-matrix --base http://localhost:3000 --project_key M60 --phase P1
```

---

## 7. 常见查询配方（直接复制改参数）

### 7.1 查某 location 的数量（例如 ISB）

```bash
python tools/issue_query.py stats --base http://localhost:3000 --project_key M60 --phase P1 --kind failed_location --match ISB
```

### 7.2 查某 symptom 的 top configs

```bash
python tools/issue_query.py stats --base http://localhost:3000 --project_key M60 --phase P1 --kind config --symptoms "Rattle lv3" --top 20
```

### 7.3 查某 test 的分布（并带分母样本数）

```bash
python tools/issue_query.py stats --base http://localhost:3000 --project_key M60 --phase P1 --kind failed_test --match "My Test"
```

### 7.4 导出 CSV（给 Excel/PowerBI）

```bash
python tools/issue_query.py stats --base http://localhost:3000 --project_key M60 --phase P1 --kind symptom --format csv > symptom.csv
```

---

## 8. 扩展指南（你后期要拓展时看这里）

### 8.1 新增一种 stats 分布类型

在脚本顶部的 `STATS_KINDS` 中增加一项即可：
- `path`：在 `/filter-statistics` 返回 JSON 中的路径
- `key`：该分布的关键字段名（用于 `--match`）

例如服务端未来增加 `ownerDistribution`，你想支持 `--kind owner`：
- 在 `STATS_KINDS` 增加：
  - `owner: {"path": ["statistics", "ownerDistribution"], "key": "owner"}`

### 8.2 新增一个子命令

参考 `cmd_stats / cmd_sample_sizes`：
- 实现 `cmd_xxx(args)`
- 在 `build_parser()` 里 `sub.add_parser(...)` 并 `set_defaults(func=cmd_xxx)`

---

## 9. 常见问题

### 9.1 为什么同一 project_key/phase 会有多个项目？
系统把 `projects` 视作“上传快照”，同一 `project_key` 可能多次上传；脚本默认选择最新 `upload_time`。如果你要固定某次快照，请用 `--project_id`。

### 9.2 `stats --kind config` 和 “各 config 的 FR” 有什么区别？
`stats` 是从 `/filter-statistics` 提取分布，偏向“数量/占比/（部分）FR字段”；真正的 FR 口径与分母样本数通常在 `/analysis` 更完整。你可以根据用途选择：
- 看数量分布：`stats --kind config`
- 看 FR 统计：`analysis` 或按需用 `cross`

