# Issue Analyzor MCP Server

这是一个本地 stdio MCP Server，用于把 Issue Analyzor 的 HTTP API 封装为 MCP tools，方便在支持 MCP 的客户端（如 Claude Desktop / Inspector）里进行“只读查询”。

## 1. 安装

```bash
cd mcp/issue-analyzor-mcp
npm install
```

## 2. 环境变量

必填：
- `ISSUE_ANALYZOR_BASE`：服务端地址，例如 `http://localhost:3000` / `https://your-domain.com`
- `ISSUE_ANALYZOR_USERNAME`：登录用户名
- `ISSUE_ANALYZOR_PASSWORD`：登录密码

## 3. 运行（stdio）

```bash
cd mcp/issue-analyzor-mcp
npm run start
```

## 4. Claude Desktop 配置示例

将下列配置加入你的 MCP 配置（路径与配置格式依客户端而定），重点是：
- command：node
- args：指向 `src/index.js`
- env：传入 base/username/password

```json
{
  "mcpServers": {
    "issue-analyzor": {
      "command": "node",
      "args": [
        "l:/Web/Issue Analyzor/mcp/issue-analyzor-mcp/src/index.js"
      ],
      "env": {
        "ISSUE_ANALYZOR_BASE": "http://localhost:3000",
        "ISSUE_ANALYZOR_USERNAME": "admin",
        "ISSUE_ANALYZOR_PASSWORD": "password123"
      }
    }
  }
}
```

## 5. Tool 清单（查询能力）

通用规则：
- 所有 tool 都是只读查询（readOnly）
- project 选择支持两种方式：
  - `projectId`
  - 或 `projectKey + phase (+ nameContains)` 自动选择最新 `upload_time` 的快照
- filters 与服务端一致：支持 `date_from/date_to/wfs/configs/failed_tests/failed_locations/symptoms/...`

主要 tools：
- `issueanalyzor_projects_list`
- `issueanalyzor_project_select`
- `issueanalyzor_sample_sizes`
- `issueanalyzor_filter_statistics`
- `issueanalyzor_analysis`
- `issueanalyzor_analysis_test`
- `issueanalyzor_cross_analysis`
- `issueanalyzor_failure_matrix`
- `issueanalyzor_issues_list`
- `issueanalyzor_filter_options`
- `issueanalyzor_api_describe`

两步查询（推荐用于“减少 tool 调用次数”）：
- `issueanalyzor_prepare_context`（Step 1/2）：一次拿齐 phases 的快照、filter vocab、sample size 汇总，返回 contextId
- `issueanalyzor_run_report`（Step 2/2）：传入 contextId + 结构化 filters，返回可直接写报告的表格数据

口径说明：
- 默认失败率（FR/ppm）分子使用 Spec-only（`specSNCount`），但仍会输出 `strifeSN` 作为参考
- 如需 Spec+Strife 合并分子，可在 Step2 传 `report.numerator = "spec_strife_unique_sn"`

示例（查 M58 的 EVT/DVT/P1 三阶段，failed_location=IR Lens 且 symptom=Crack 的对比表）：
1) Step 1：准备 context
```json
{
  "projectKey": "M58",
  "phases": ["EVT", "DVT", "P1"],
  "vocabKeys": ["failed_locations", "symptoms"],
  "vocabLimit": 50,
  "includeByPhase": false
}
```
2) Step 2：运行报表
```json
{
  "contextId": "<from step1>",
  "filters": {
    "failed_locations": "IR Lens",
    "symptoms": "Crack"
  },
  "report": {
    "numerator": "spec_unique_sn"
  }
}
```

示例（查具体测试的分 config FR：M60 P1，failed_test=Random Drop 1m PB，failed_location=BT-OTA）：
1) Step 1：准备 context（这类问题需要 failed_tests + configs）
```json
{
  "projectKey": "M60",
  "phases": ["P1"],
  "vocabKeys": ["failed_tests", "failed_locations", "configs"],
  "vocabLimit": 50
}
```
2) Step 2：运行报表（按测试分 config 的 FR）
```json
{
  "contextId": "<from step1>",
  "filters": {
    "failed_tests": "Random Drop 1m PB",
    "failed_locations": "BT-OTA"
  },
  "report": {
    "kind": "test_config_fr",
    "numerator": "spec_unique_sn"
  }
}
```

## 6. MCP Inspector（可选）

你可以用 MCP Inspector 验证 tools 是否可调用（以官方工具为准）：

```bash
npx @modelcontextprotocol/inspector
```
