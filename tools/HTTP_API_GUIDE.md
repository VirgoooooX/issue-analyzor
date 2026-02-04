# HTTP API 使用说明（为脚本/集成开发准备）

本文档描述 Issue Analyzor 服务端提供的 HTTP API 能力（只描述服务端能力，不包含本地脚本实现细节），用于后续开发各种本地脚本、报表、自动化查询与集成。

API 以 REST 风格为主，返回统一 JSON 包装：

```json
{
  "success": true,
  "data": { }
}
```

失败时：

```json
{
  "success": false,
  "error": { "code": "SOME_CODE", "message": "..." }
}
```

---

## 1. 基础信息

### 1.1 Base URL

以你的部署地址为准，例如：
- 本地：`http://localhost:3000`
- 云端：`https://your-domain.com`

下文用 `{BASE}` 表示 base URL。

### 1.2 Content-Type

- 请求：大多数为 JSON（上传接口为 multipart/form-data）
- 响应：`application/json`

---

## 2. 认证与权限

### 2.1 登录获取 Token

**POST** `{BASE}/api/auth/login`

Body（JSON）：
```json
{ "username": "admin", "password": "password123" }
```

成功响应（示例）：
```json
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "username": "admin",
    "id": 1,
    "role": "admin",
    "expiresIn": "7d"
  }
}
```

### 2.2 请求携带 Token

除 `/api/auth/*` 外，多数查询 API 都需要携带 Authorization header：

```
Authorization: Bearer <JWT>
```

### 2.3 校验 Token

**GET** `{BASE}/api/auth/verify`

需要鉴权，返回当前用户信息与状态。

### 2.4 权限概念（简述）

- `/api/projects/*`：受鉴权保护
- 上传与删除等写操作通常要求更高权限（admin/manager）
- 本文档重点在“只读查询”，仍建议云端部署时开启鉴权并使用强 token secret

---

## 3. Health Check

**GET** `{BASE}/api/health`

用于确认服务是否存活、数据库路径、缓存状态等。

---

## 4. Projects（项目/上传快照）

系统将每次上传解析后的结果存入一条 `projects` 记录；同一 `project_key` 可对应多次上传（快照），`upload_time` 区分。

### 4.1 列出项目

**GET** `{BASE}/api/projects`

返回项目列表（包含 id/name/project_key/phase/upload_time 等）。

### 4.2 获取项目详情

**GET** `{BASE}/api/projects/{projectId}`

### 4.3 删除项目

**DELETE** `{BASE}/api/projects/{projectId}`

说明：属于写操作，通常需要更高权限；脚本查询场景一般不需要。

### 4.4 上传项目（Excel）

**POST** `{BASE}/api/projects`

Content-Type：`multipart/form-data`

字段：
- `file`: Excel 文件

说明：属于写操作，通常需要更高权限。

---

## 5. 通用 Filters（大多数查询接口通用）

下列 filters 主要由 `/api/projects/{id}/issues` 解析，并被分析接口复用。

### 5.1 日期范围
- `date_from=YYYY-MM-DD`
- `date_to=YYYY-MM-DD`

### 5.2 多选 filters（逗号分隔或多次传参均可）
- `priorities`
- `sample_statuses`
- `departments`
- `wfs`
- `configs`
- `failed_tests`
- `test_ids`
- `failure_types`
- `function_cosmetic`
- `failed_locations`
- `symptoms`
- `fa_statuses`

示例：
```
?wfs=1,2,3&configs=R1CASN,R2CBCN&failed_locations=ISB
```

### 5.3 文本搜索
- `unit_number`：在 raw_data 中模糊匹配 Unit#
- `sn`：在 raw_data 中模糊匹配 SN
- `fa_search`：FA# 模糊匹配

### 5.4 分页与排序（仅 issues 明细接口）
- `page`（默认 1）
- `limit`（默认 100）
- `sort_by`（默认 open_date；可选值见接口实现）
- `sort_order`（ASC/DESC）

---

## 6. Issues（明细查询）

### 6.1 查询 issues（分页）

**GET** `{BASE}/api/projects/{projectId}/issues`

Query：支持所有 filters + page/limit/sort。

响应 data 结构：
```json
{
  "issues": [ { "...": "..." } ],
  "total": 1234,
  "page": 1,
  "limit": 100
}
```

典型用途：
- 拉明细做自定义聚合（当服务端没有直接提供某种分布时）
- 对某个统计结果下钻（获取具体 FA#/SN/行记录）

---

## 7. Filter Options（联动下拉/探索式查询）

### 7.1 获取可选值集合

**GET** `{BASE}/api/projects/{projectId}/filter-options`

Query：`currentFilters`（同 filters），服务端会“排除本维度自身的筛选，但保留其他筛选”，返回每个维度在当前上下文下还能选哪些值。

典型用途：
- 在脚本里做“探索式”枚举：例如先固定 date/wf，再列出当前可选 symptom/config/test

---

## 8. Analysis（失败率/维度统计）

### 8.1 综合分析（overview + 多维统计）

**GET** `{BASE}/api/projects/{projectId}/analysis`

Query：支持 filters（wfs/configs/failed_tests/date_from/date_to 等）。

返回内容（概览）：
- `overview`：总 issue 数、Spec/Strife 数、SN 去重计数、总体 FR（ppm）等
- `symptomStats`：按 symptom 聚合的 FR/计数
- `wfStats`：按 wf 聚合的 FR/计数
- `configStats`：按 config 聚合的 FR/计数（分母为 config sample size 汇总）
- `testStats`：按 failed_test 聚合的 FR/计数（每个 test 自己的样本分母）
- `failureTypeStats/functionCosmeticStats/faStatusStats`：其他分布

说明（口径要点）：
- FR 计算使用 SN 去重（无 SN 时用 fa_number 兜底）
- 默认会排除 `fa_status = "retest pass"` 的 issues 进入分析口径

### 8.2 Test 维度分析

**GET** `{BASE}/api/projects/{projectId}/analysis/test`

典型用途：
- 只拉 testStats（更轻量）

---

## 9. Cross Analysis（维度×维度交叉）

### 9.1 任意两维交叉分析

**GET** `{BASE}/api/projects/{projectId}/analysis/cross`

Query：
- `dimension1`
- `dimension2`
- + filters

维度值一般来自 issues 的字段，例如：
- `wf`
- `config`
- `symptom`
- `failed_test`
- `failed_location`

典型用途：
- “symptom × config” 找某 symptom 在哪些 config 上更集中
- “failed_location × wf” 看某 location 在哪些 wf 更集中

---

## 10. Filter Statistics（筛选结果页统计 / 多分布聚合）

### 10.1 获取筛选结果统计

**GET** `{BASE}/api/projects/{projectId}/filter-statistics`

Query：
- `includeTrend=true|false`
- + filters

返回 `data.statistics`（重点字段）：
- `totalCount/specCount/strifeCount`
- `specSNCount/strifeSNCount`（用于 FR 的 SN 去重分子）
- `totalSamples`（filters 下的样本总数）
- `symptomDistribution`
- `wfDistribution`
- `configDistribution`
- `failedTestDistribution`（新增）
- `failedLocationDistribution`（新增）
- `failureTypeDistribution`
- `functionCosmeticDistribution`
- `faStatusDistribution`

典型用途：
- 一次请求得到“多个维度的分布”，适合脚本做 TopN、阈值监控、报表
- `failedTestDistribution` 内含每个 test 的 `totalSamples`（按该 test 覆盖的 WF 计算）
- `failedLocationDistribution` 使用当前 filters 的 `totalSamples` 作为分母

趋势：
- 当 `includeTrend=true` 且同时提供 `date_from/date_to` 时，会返回按 day/week/month 粒度的趋势数据（用于画趋势图）

---

## 11. Failure Rate Matrix（WF×Test×Config）

### 11.1 获取失败率矩阵

**GET** `{BASE}/api/projects/{projectId}/failure-rate-matrix`

Query：支持 filters。

典型用途：
- “定位”问题集中在哪些 WF/Test/Config 单元格
- 结合 issues 明细做下钻

---

## 12. 常见查询配方（用于后续脚本开发的思路）

### 12.1 某 symptom 的各 config FR
推荐两种方式：
1) `/analysis` 的 `configStats`（FR 更直接、更贴近你们分析页）
2) `/analysis/cross` 做 `dimension1=config&dimension2=symptom`（用于交叉比较）

### 12.2 某 failed_location（如 ISB）的数量与分布
1) `/filter-statistics` 直接从 `failedLocationDistribution` 取 `ISB`
2) 如需 ISB 子集下的 config 分布：带 `failed_locations=ISB` 再取 `configDistribution`

### 12.3 获取 WF/Test/Config 的 sample size
`/sample-sizes` 直接返回明细（tests/config_samples），脚本侧可直接汇总或 join 到分析结果。

---

## 13. 注意事项（云端部署与查询稳定性）

- 强烈建议云端启用鉴权并设置强 `AUTH_TOKEN_SECRET`
- 避免把管理/上传接口暴露给不受控网络；必要时做 IP allowlist/VPN
- `issues` 明细查询是分页接口，建议脚本侧不要无限拉全表；优先使用 `/filter-statistics`、`/analysis` 这类聚合接口

---

## 14. Saved Filters（保存筛选条件，便于脚本复用）

该能力用于把某一组 filters 以名字保存到服务端（按用户隔离），后续脚本可以先拉取保存的 filters 再用于各种查询接口。

### 14.1 保存筛选条件

**POST** `{BASE}/api/filters`

需要鉴权。

Body（JSON）：
```json
{
  "projectId": 7,
  "name": "M60_P1_ISB",
  "filters": { "failed_locations": "ISB", "wfs": "1,2,3" }
}
```

### 14.2 列出已保存筛选条件

**GET** `{BASE}/api/filters`

Query（可选）：
- `projectId`

### 14.3 删除已保存筛选条件

**DELETE** `{BASE}/api/filters/{id}`

---

## 15. Admin Users（管理员用户管理）

说明：此类接口主要用于后台用户管理，一般不属于“只读数据查询”脚本的必需能力，但仍在此列出以便集成。

这些接口需要 `admin` 权限（服务端通过 requireAdmin 保护）。

### 15.1 列出用户

**GET** `{BASE}/api/admin/users`

### 15.2 创建用户

**POST** `{BASE}/api/admin/users`

### 15.3 更新用户

**PATCH** `{BASE}/api/admin/users/{id}`

### 15.4 删除用户

**DELETE** `{BASE}/api/admin/users/{id}`
