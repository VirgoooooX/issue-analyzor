# Issue Analyzor MCP 查询 Playbook（两步法）

这份 Playbook 用于把你们“减少 tool 调用次数 + LLM 输出可控口径报告”的思路固化下来，便于后续：
- 新人快速上手
- 统一口径（Spec-only FR）
- 作为“Skill 文档”放进任何 LLM 客户端的自定义指令

---

## 适用场景
- 用户问题是“查某项目/多个阶段/某组合条件的 FR、对比、TopN”
- 目标是 **最少 MCP 调用次数**（优先 2 次：prepare_context → run_report）

不适用（需要明细下钻）：
- 需要列出具体 SN/FA#/unit_number 明细
- 需要导出大批量 issues 供外部系统处理

---

## 关键约定

### 口径
- 默认失败率 FR（ppm）分子：**Spec-only**（`specSNCount`）
- Strife：只作为参考输出（`strifeSNCount`），不计入 FR 分子

### 语义分解
很多业务短语是“组合概念”，必须拆成多字段 filters：
- “IR Crack” → `failed_locations="IR Lens"` + `symptoms="Crack"`
- “Siri Loose” → `failed_locations="Siri"` + `symptoms="Loose"`

规则：如果短语里包含“部位/站点/位置”的简称（IR、ISB、Siri…）+ “失效现象”（Crack、Loose…），优先解释为 `failed_locations + symptoms` 的组合，而不是单个字段值。

### 默认项目/阶段（当用户没说清）
- 如果用户没有指定项目名和阶段：默认查询“系统最新上传的快照”（latest upload_time）。
- 如果用户只指定项目名：默认选该项目名下最新快照。
- 如果用户只指定阶段：默认选该阶段下最新快照。

---

## 两步法：标准流程

### Step 1：Prepare Context（一次）
目的：让 LLM 后续**不再猜值**，而是从候选中选择真实存在的字段值，并一次拿到快照与分母汇总。

调用：
- `issueanalyzor_prepare_context(projectKey, phases[])`

Token 优化（强烈建议）：
- 只取你本次查询需要的维度候选：`vocabKeys=["failed_locations","symptoms"]`（默认）
- 如果用户问 config/test/wf，再把对应维度加入 `vocabKeys`
- 用 `vocabLimit` 控制每个维度最多返回多少候选（默认 50）
- 默认不返回 `byPhase`（很大）；只有需要解释“为什么某阶段为 0”时才开启 `includeByPhase=true`

输出使用方式：
- `snapshots`：确认每个 phase 选到的 projectId（最新快照）
- `vocab.union`：用于把用户词映射到真实候选值（优先使用 union）
- `vocab.byPhase`：当 union 里存在，但某个阶段不存在时用于解释“为什么某阶段为 0”
- `sampleSize`：避免重复调用 sample-sizes；分母以 totalSamples（filters 下）为准

### Step 2：Run Report（一次）
目的：输入结构化 filters，输出可直接写报告的 phase 对比表。

调用：
- `issueanalyzor_run_report(contextId, filters, report)`

默认 report：
- `numerator = "spec_unique_sn"`（Spec-only）

可选：
- 若某次确实要 Spec+Strife 合并分子，设置 `numerator="spec_strife_unique_sn"`

---

## 输出模板（建议固定）

### 1) 结论摘要
- 结论 1（最重要的变化/对比）
- 结论 2（异常点/集中点）
- 结论 3（建议行动：继续观察/下钻明细/补充样本）

### 2) 数据表（phase × 指标）
列建议：
- phase
- failuresSN（Spec-only）
- specSN（参考）
- strifeSN（参考）
- totalSamples（分母）
- frPpm（ppm）

### 3) 口径说明
- FR 分子：Spec-only（specSNCount）
- Strife：仅作为参考输出，不计入 FR
- 分母：filter-statistics 的 totalSamples（与 filters 联动）

---

## 常见错误与纠偏

### 错误 1：把组合词当成单一维度值
症状：`symptoms="IR Crack"` 查不到。
修正：拆解为 `failed_locations="IR Lens"` + `symptoms="Crack"`，并从 vocab 候选里选择真实值。

### 错误 2：值不在候选中导致“全为 0”
症状：所有阶段 0，但用户坚信有数据。
修正：
- 用 vocab 做近似匹配（大小写、空格、包含）
- 若仍不匹配，列出候选值建议并向用户确认映射规则

### 错误 3：阶段快照不一致
症状：同 projectKey 不同 phase 选到的快照 upload_time 相差较大。
修正：在摘要里提示“本次使用的是各阶段最新快照”，必要时允许用户指定 projectId。
