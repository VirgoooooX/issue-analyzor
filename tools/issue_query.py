import argparse
import csv
import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime


FILTER_SPECS = [
  {"name": "date_from", "type": "string", "example": "2025-12-01", "desc": "Open Date 起始（含）"},
  {"name": "date_to", "type": "string", "example": "2025-12-31", "desc": "Open Date 结束（含）"},
  {"name": "priorities", "type": "csv", "example": "P0,P1", "desc": "Priority 多选"},
  {"name": "sample_statuses", "type": "csv", "example": "Fail,Pass", "desc": "Sample Status 多选"},
  {"name": "departments", "type": "csv", "example": "EE,ME", "desc": "Department 多选"},
  {"name": "wfs", "type": "csv", "example": "1,2,3", "desc": "WF 多选"},
  {"name": "configs", "type": "csv", "example": "R1CASN,R2CBCN", "desc": "Config 多选"},
  {"name": "failed_tests", "type": "csv", "example": "Test A,Test B", "desc": "Failed Test 多选"},
  {"name": "test_ids", "type": "csv", "example": "Test1,Test2", "desc": "Test ID 多选"},
  {"name": "failure_types", "type": "csv", "example": "Spec.,Strife", "desc": "Failure Type 多选"},
  {"name": "function_cosmetic", "type": "csv", "example": "Function,Cosmetic", "desc": "Function/Cosmetic 多选"},
  {"name": "failed_locations", "type": "csv", "example": "ISB,USB", "desc": "Failed Location 多选"},
  {"name": "symptoms", "type": "csv", "example": "Rattle lv3", "desc": "Symptom 多选"},
  {"name": "fa_statuses", "type": "csv", "example": "open,close", "desc": "FA Status 多选"},
  {"name": "unit_number", "type": "string", "example": "Unit123", "desc": "Unit# 模糊搜索"},
  {"name": "sn", "type": "string", "example": "SN001", "desc": "SN 模糊搜索"},
  {"name": "fa_search", "type": "string", "example": "FA-2025", "desc": "FA# 模糊搜索"},
  {"name": "page", "type": "int", "example": "1", "desc": "分页页码（仅 issues 接口使用）"},
  {"name": "limit", "type": "int", "example": "100", "desc": "分页大小（issues 接口默认 100）"},
  {"name": "sort_by", "type": "string", "example": "open_date", "desc": "排序字段（issues）"},
  {"name": "sort_order", "type": "string", "example": "DESC", "desc": "排序方向（ASC/DESC）"},
  {"name": "includeTrend", "type": "bool", "example": "false", "desc": "filter-statistics 是否返回趋势"},
]

QUERY_METHODS = [
  {"cmd": "projects", "endpoint": "GET /api/projects", "desc": "列出所有 projects（上传快照）"},
  {"cmd": "issues", "endpoint": "GET /api/projects/:id/issues", "desc": "按 filters 拉 issues 明细（分页）"},
  {"cmd": "filter-options", "endpoint": "GET /api/projects/:id/filter-options", "desc": "按 currentFilters 返回各维度可选值"},
  {"cmd": "analysis", "endpoint": "GET /api/projects/:id/analysis", "desc": "返回 overview + 各维度 FR（symptom/wf/config/test 等）"},
  {"cmd": "analysis-test", "endpoint": "GET /api/projects/:id/analysis/test", "desc": "Test 维度分析"},
  {"cmd": "cross", "endpoint": "GET /api/projects/:id/analysis/cross", "desc": "任意维度×维度交叉分析"},
  {"cmd": "filter-stats", "endpoint": "GET /api/projects/:id/filter-statistics", "desc": "筛选结果统计（含 symptom/wf/config 等分布）"},
  {"cmd": "stats", "endpoint": "GET /api/projects/:id/filter-statistics + 提取分布", "desc": "从 filter-statistics 提取某个分布并格式化输出"},
  {"cmd": "sample-sizes", "endpoint": "GET /api/projects/:id/sample-sizes", "desc": "WF/Test/Config 样本量明细"},
  {"cmd": "failure-matrix", "endpoint": "GET /api/projects/:id/failure-rate-matrix", "desc": "WF×Test×Config 失败率矩阵"},
  {"cmd": "describe", "endpoint": "(local)", "desc": "打印脚本支持的 filters 与查询方法清单"},
]

STATS_KINDS = {
  "symptom": {"path": ["statistics", "symptomDistribution"], "key": "symptom"},
  "wf": {"path": ["statistics", "wfDistribution"], "key": "wf"},
  "config": {"path": ["statistics", "configDistribution"], "key": "config"},
  "failed_test": {"path": ["statistics", "failedTestDistribution"], "key": "testName"},
  "failed_location": {"path": ["statistics", "failedLocationDistribution"], "key": "failedLocation"},
  "failure_type": {"path": ["statistics", "failureTypeDistribution"], "key": "type"},
  "function_cosmetic": {"path": ["statistics", "functionCosmeticDistribution"], "key": "category"},
  "fa_status": {"path": ["statistics", "faStatusDistribution"], "key": "status"},
}


def _iso_now():
  return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _json_dumps(data):
  return json.dumps(data, ensure_ascii=False, indent=2)


def _http_json(method, url, headers=None, body_obj=None, timeout=60):
  req_headers = {"Accept": "application/json"}
  if headers:
    req_headers.update(headers)
  data = None
  if body_obj is not None:
    payload = json.dumps(body_obj, ensure_ascii=False).encode("utf-8")
    data = payload
    req_headers["Content-Type"] = "application/json; charset=utf-8"
  req = urllib.request.Request(url=url, method=method, headers=req_headers, data=data)
  try:
    with urllib.request.urlopen(req, timeout=timeout) as resp:
      raw = resp.read().decode("utf-8", errors="replace")
      if not raw:
        return None
      return json.loads(raw)
  except urllib.error.HTTPError as e:
    raw = e.read().decode("utf-8", errors="replace")
    try:
      parsed = json.loads(raw) if raw else {}
    except Exception:
      parsed = {"raw": raw}
    raise RuntimeError(f"HTTP {e.code} {e.reason}: {parsed}") from None
  except urllib.error.URLError as e:
    raise RuntimeError(f"Request failed: {e}") from None


def _build_url(base, path, params=None):
  base = base.rstrip("/")
  if not path.startswith("/"):
    path = "/" + path
  url = base + path
  if params:
    encoded = urllib.parse.urlencode(params, doseq=True)
    if encoded:
      url += "?" + encoded
  return url


def _parse_csv(value):
  if value is None:
    return None
  if isinstance(value, list):
    items = []
    for v in value:
      items.extend([x.strip() for x in str(v).split(",")])
    items = [x for x in items if x]
    return ",".join(items) if items else None
  items = [x.strip() for x in str(value).split(",")]
  items = [x for x in items if x]
  return ",".join(items) if items else None


def _maybe_get_env(name):
  v = os.environ.get(name)
  return v if v else None


def _resolve_auth(args):
  username = args.username or _maybe_get_env("ISSUE_ANALYZOR_USERNAME")
  password = args.password or _maybe_get_env("ISSUE_ANALYZOR_PASSWORD")
  if not username:
    username = input("username: ").strip()
  if not password:
    password = getpass.getpass("password: ")
  if not username or not password:
    raise RuntimeError("Missing username/password")
  return username, password


def login(base, username, password):
  url = _build_url(base, "/api/auth/login")
  data = _http_json("POST", url, body_obj={"username": username, "password": password}, timeout=60)
  token = (((data or {}).get("data") or {}).get("token")) if isinstance(data, dict) else None
  if not token:
    raise RuntimeError(f"Login failed: {data}")
  return token


def api_get(base, token, path, params=None):
  url = _build_url(base, path, params=params)
  headers = {"Authorization": f"Bearer {token}"}
  data = _http_json("GET", url, headers=headers, timeout=120)
  if not isinstance(data, dict) or not data.get("success"):
    raise RuntimeError(f"Unexpected response: {data}")
  return data.get("data")


def _parse_upload_time(s):
  if not s:
    return None
  try:
    return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
  except Exception:
    return None


def select_project(projects, project_id=None, project_key=None, phase=None, name=None):
  if project_id is not None:
    for p in projects:
      if str(p.get("id")) == str(project_id):
        return p
    raise RuntimeError(f"project_id not found: {project_id}")
  candidates = projects
  if project_key:
    candidates = [p for p in candidates if str(p.get("project_key") or "").strip() == project_key]
  if phase:
    candidates = [p for p in candidates if str(p.get("phase") or "").strip() == phase]
  if name:
    needle = str(name).strip().lower()
    candidates = [p for p in candidates if needle in str(p.get("name") or "").lower()]
  if not candidates:
    raise RuntimeError("No project matches selection criteria")
  candidates.sort(
    key=lambda p: (
      _parse_upload_time(p.get("upload_time")) or datetime.min,
      int(p.get("id") or 0),
    ),
    reverse=True,
  )
  return candidates[0]


def _extract_path(obj, path_list):
  cur = obj
  for k in path_list:
    if cur is None:
      return None
    if isinstance(cur, dict):
      cur = cur.get(k)
    else:
      return None
  return cur


def _print_table(rows, columns, out_stream):
  def cell(row, col):
    v = row.get(col, "")
    if v is None:
      return ""
    return str(v)

  widths = {c: len(c) for c in columns}
  for r in rows:
    for c in columns:
      widths[c] = max(widths[c], len(cell(r, c)))

  header = "  ".join(c.ljust(widths[c]) for c in columns)
  sep = "  ".join("-" * widths[c] for c in columns)
  out_stream.write(header + "\n")
  out_stream.write(sep + "\n")
  for r in rows:
    out_stream.write("  ".join(cell(r, c).ljust(widths[c]) for c in columns) + "\n")


def _write_csv(rows, columns, out_stream):
  writer = csv.DictWriter(out_stream, fieldnames=columns, extrasaction="ignore")
  writer.writeheader()
  for r in rows:
    writer.writerow({c: r.get(c) for c in columns})


def _filters_from_args(args):
  filters = {}
  for spec in FILTER_SPECS:
    name = spec["name"]
    if not hasattr(args, name):
      continue
    value = getattr(args, name)
    if value is None:
      continue
    if spec["type"] == "csv":
      value = _parse_csv(value)
    if spec["type"] == "bool":
      value = "true" if bool(value) else "false"
    filters[name] = value
  if getattr(args, "filter", None):
    for item in args.filter:
      if "=" not in item:
        raise RuntimeError(f"Invalid --filter, expect key=value: {item}")
      k, v = item.split("=", 1)
      k = k.strip()
      v = v.strip()
      if not k:
        continue
      filters[k] = v
  return filters


def cmd_describe(args):
  payload = {
    "generated_at": _iso_now(),
    "query_methods": QUERY_METHODS,
    "filter_parameters": FILTER_SPECS,
    "stats_kinds": [{"name": k, "json_path": ".".join(v["path"]), "key_field": v["key"]} for k, v in STATS_KINDS.items()],
  }
  sys.stdout.write(_json_dumps(payload) + "\n")


def cmd_projects(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  projects = api_get(args.base, token, "/api/projects", params={})
  if not isinstance(projects, list):
    raise RuntimeError(f"Unexpected projects payload: {projects}")
  if args.project_key:
    projects = [p for p in projects if str(p.get("project_key") or "") == args.project_key]
  if args.phase:
    projects = [p for p in projects if str(p.get("phase") or "") == args.phase]
  if args.name:
    needle = args.name.strip().lower()
    projects = [p for p in projects if needle in str(p.get("name") or "").lower()]

  fmt = args.format
  if fmt == "json":
    sys.stdout.write(_json_dumps(projects) + "\n")
    return

  rows = [
    {
      "id": p.get("id"),
      "name": p.get("name"),
      "project_key": p.get("project_key"),
      "phase": p.get("phase"),
      "upload_time": p.get("upload_time"),
      "file_name": p.get("file_name"),
    }
    for p in projects
  ]
  cols = ["id", "name", "project_key", "phase", "upload_time", "file_name"]
  if fmt == "csv":
    _write_csv(rows, cols, sys.stdout)
  else:
    _print_table(rows, cols, sys.stdout)


def _get_selected_project(args, token):
  projects = api_get(args.base, token, "/api/projects", params={})
  if not isinstance(projects, list):
    raise RuntimeError(f"Unexpected projects payload: {projects}")
  selected = select_project(
    projects,
    project_id=args.project_id,
    project_key=args.project_key,
    phase=args.phase,
    name=args.project_name,
  )
  return selected


def cmd_sample_sizes(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  data = api_get(args.base, token, f"/api/projects/{pid}/sample-sizes", params={})
  fmt = args.format
  if fmt == "json":
    sys.stdout.write(_json_dumps({"project": project, "sample_sizes": data}) + "\n")
    return
  rows = []
  for r in data or []:
    rows.append(
      {
        "waterfall": r.get("waterfall"),
        "test_name": r.get("test_name"),
        "tests_count": len(r.get("tests") or []),
        "config_samples_keys": len((r.get("config_samples") or {}).keys()),
      }
    )
  cols = ["waterfall", "test_name", "tests_count", "config_samples_keys"]
  _print_table(rows, cols, sys.stdout)


def cmd_filter_stats(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  data = api_get(args.base, token, f"/api/projects/{pid}/filter-statistics", params=filters)
  sys.stdout.write(_json_dumps({"project": project, "filters": filters, "data": data}) + "\n")


def cmd_stats(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  data = api_get(args.base, token, f"/api/projects/{pid}/filter-statistics", params=filters)
  kind = STATS_KINDS.get(args.kind)
  if not kind:
    raise RuntimeError(f"Unknown kind: {args.kind}")
  rows = _extract_path(data, kind["path"]) or []
  if not isinstance(rows, list):
    raise RuntimeError(f"Unexpected stats rows for {args.kind}: {rows}")

  if args.match:
    needle = args.match.strip().lower()
    key_field = kind["key"]
    rows = [r for r in rows if needle in str(r.get(key_field) or "").strip().lower()]

  if args.order_by:
    sort_key = args.order_by
    reverse = args.order_dir.lower() == "desc"
    rows.sort(key=lambda r: (r.get(sort_key) is None, r.get(sort_key)), reverse=reverse)

  if args.top and args.top > 0:
    rows = rows[: args.top]

  if args.format == "json":
    sys.stdout.write(_json_dumps({"project": project, "filters": filters, "kind": args.kind, "rows": rows}) + "\n")
    return

  default_columns = [kind["key"], "totalCount", "specCount", "strifeCount", "specSNCount", "strifeSNCount", "totalSamples", "specFailureRate"]
  columns = args.columns.split(",") if args.columns else default_columns
  columns = [c.strip() for c in columns if c.strip()]

  if args.format == "csv":
    _write_csv(rows, columns, sys.stdout)
  else:
    _print_table(rows, columns, sys.stdout)


def cmd_analysis(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  data = api_get(args.base, token, f"/api/projects/{pid}/analysis", params=filters)
  sys.stdout.write(_json_dumps({"project": project, "filters": filters, "data": data}) + "\n")


def cmd_analysis_test(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  data = api_get(args.base, token, f"/api/projects/{pid}/analysis/test", params=filters)
  sys.stdout.write(_json_dumps({"project": project, "filters": filters, "data": data}) + "\n")


def cmd_cross(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  filters = {**filters, "dimension1": args.dimension1, "dimension2": args.dimension2}
  data = api_get(args.base, token, f"/api/projects/{pid}/analysis/cross", params=filters)
  sys.stdout.write(_json_dumps({"project": project, "filters": filters, "data": data}) + "\n")


def cmd_issues(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  data = api_get(args.base, token, f"/api/projects/{pid}/issues", params=filters)
  sys.stdout.write(_json_dumps({"project": project, "filters": filters, "data": data}) + "\n")


def cmd_filter_options(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  data = api_get(args.base, token, f"/api/projects/{pid}/filter-options", params=filters)
  sys.stdout.write(_json_dumps({"project": project, "filters": filters, "data": data}) + "\n")


def cmd_failure_matrix(args):
  username, password = _resolve_auth(args)
  token = login(args.base, username, password)
  project = _get_selected_project(args, token)
  pid = project["id"]
  filters = _filters_from_args(args)
  data = api_get(args.base, token, f"/api/projects/{pid}/failure-rate-matrix", params=filters)
  sys.stdout.write(_json_dumps({"project": project, "filters": filters, "data": data}) + "\n")


def add_project_select_args(parser):
  parser.add_argument("--project_id", type=int, default=None, help="直接指定 project_id（优先级最高）")
  parser.add_argument("--project_key", type=str, default=None, help="按 project_key 选择（例如 M60）")
  parser.add_argument("--phase", type=str, default=None, help="按 phase 选择（例如 P1/DVT/EVT）")
  parser.add_argument("--project_name", type=str, default=None, help="按 name 包含匹配选择（例如 'FA Tracker'）")


def add_auth_args(parser):
  parser.add_argument("--base", type=str, default="http://localhost:3000", help="服务端地址（例如 https://xxx.com）")
  parser.add_argument("--username", type=str, default=None, help="登录用户名（也可用环境变量 ISSUE_ANALYZOR_USERNAME）")
  parser.add_argument("--password", type=str, default=None, help="登录密码（也可用环境变量 ISSUE_ANALYZOR_PASSWORD）")


def add_output_args(parser):
  parser.add_argument("--format", type=str, choices=["table", "json", "csv"], default="table", help="输出格式")


def add_filter_args(parser):
  parser.add_argument("--date_from", type=str, default=None)
  parser.add_argument("--date_to", type=str, default=None)
  parser.add_argument("--priorities", type=str, default=None)
  parser.add_argument("--sample_statuses", type=str, default=None)
  parser.add_argument("--departments", type=str, default=None)
  parser.add_argument("--wfs", type=str, default=None)
  parser.add_argument("--configs", type=str, default=None)
  parser.add_argument("--failed_tests", type=str, default=None)
  parser.add_argument("--test_ids", type=str, default=None)
  parser.add_argument("--failure_types", type=str, default=None)
  parser.add_argument("--function_cosmetic", type=str, default=None)
  parser.add_argument("--failed_locations", type=str, default=None)
  parser.add_argument("--symptoms", type=str, default=None)
  parser.add_argument("--fa_statuses", type=str, default=None)
  parser.add_argument("--unit_number", type=str, default=None)
  parser.add_argument("--sn", type=str, default=None)
  parser.add_argument("--fa_search", type=str, default=None)
  parser.add_argument("--page", type=int, default=None)
  parser.add_argument("--limit", type=int, default=None)
  parser.add_argument("--sort_by", type=str, default=None)
  parser.add_argument("--sort_order", type=str, default=None)
  parser.add_argument("--includeTrend", action="store_true", default=None)
  parser.add_argument("--filter", action="append", default=None, help="附加 query 参数：key=value（可重复）")


def build_parser():
  parser = argparse.ArgumentParser(prog="issue_query", description="Issue Analyzor 云端只读查询 CLI（带参数、可扩展）")
  sub = parser.add_subparsers(dest="cmd", required=True)

  p_describe = sub.add_parser("describe", help="打印脚本支持的 filters 与查询方法清单（JSON）")
  p_describe.set_defaults(func=cmd_describe)

  p_projects = sub.add_parser("projects", help="列出 projects（上传快照）")
  add_auth_args(p_projects)
  add_output_args(p_projects)
  p_projects.add_argument("--project_key", type=str, default=None)
  p_projects.add_argument("--phase", type=str, default=None)
  p_projects.add_argument("--name", type=str, default=None)
  p_projects.set_defaults(func=cmd_projects)

  p_sample = sub.add_parser("sample-sizes", help="查询 sample sizes（WF/Test/Config 样本量明细）")
  add_auth_args(p_sample)
  add_project_select_args(p_sample)
  add_output_args(p_sample)
  p_sample.set_defaults(func=cmd_sample_sizes)

  p_filter_stats = sub.add_parser("filter-stats", help="调用 /filter-statistics（原样输出 JSON）")
  add_auth_args(p_filter_stats)
  add_project_select_args(p_filter_stats)
  add_filter_args(p_filter_stats)
  p_filter_stats.set_defaults(func=cmd_filter_stats)

  p_stats = sub.add_parser("stats", help="从 /filter-statistics 提取某个分布并输出（table/json/csv）")
  add_auth_args(p_stats)
  add_project_select_args(p_stats)
  add_filter_args(p_stats)
  add_output_args(p_stats)
  p_stats.add_argument("--kind", type=str, choices=sorted(STATS_KINDS.keys()), required=True, help="要提取的分布类型")
  p_stats.add_argument("--match", type=str, default=None, help="按关键字段模糊匹配过滤（例如 ISB / Rattle lv3）")
  p_stats.add_argument("--top", type=int, default=0, help="仅输出前 N 行（0=不限制）")
  p_stats.add_argument("--order_by", type=str, default=None, help="按字段排序（例如 totalCount/specFailureRate）")
  p_stats.add_argument("--order_dir", type=str, choices=["asc", "desc"], default="desc")
  p_stats.add_argument("--columns", type=str, default=None, help="自定义输出列（逗号分隔）")
  p_stats.set_defaults(func=cmd_stats)

  p_analysis = sub.add_parser("analysis", help="调用 /analysis（overview + 各维度统计）")
  add_auth_args(p_analysis)
  add_project_select_args(p_analysis)
  add_filter_args(p_analysis)
  p_analysis.set_defaults(func=cmd_analysis)

  p_analysis_test = sub.add_parser("analysis-test", help="调用 /analysis/test（Test 维度分析）")
  add_auth_args(p_analysis_test)
  add_project_select_args(p_analysis_test)
  add_filter_args(p_analysis_test)
  p_analysis_test.set_defaults(func=cmd_analysis_test)

  p_cross = sub.add_parser("cross", help="调用 /analysis/cross（维度×维度交叉分析）")
  add_auth_args(p_cross)
  add_project_select_args(p_cross)
  add_filter_args(p_cross)
  p_cross.add_argument("--dimension1", type=str, required=True)
  p_cross.add_argument("--dimension2", type=str, required=True)
  p_cross.set_defaults(func=cmd_cross)

  p_issues = sub.add_parser("issues", help="调用 /issues（分页 issues 明细）")
  add_auth_args(p_issues)
  add_project_select_args(p_issues)
  add_filter_args(p_issues)
  p_issues.set_defaults(func=cmd_issues)

  p_opts = sub.add_parser("filter-options", help="调用 /filter-options（联动下拉可选值）")
  add_auth_args(p_opts)
  add_project_select_args(p_opts)
  add_filter_args(p_opts)
  p_opts.set_defaults(func=cmd_filter_options)

  p_matrix = sub.add_parser("failure-matrix", help="调用 /failure-rate-matrix（WF×Test×Config 矩阵）")
  add_auth_args(p_matrix)
  add_project_select_args(p_matrix)
  add_filter_args(p_matrix)
  p_matrix.set_defaults(func=cmd_failure_matrix)

  return parser


def main():
  parser = build_parser()
  args = parser.parse_args()
  try:
    args.func(args)
  except Exception as e:
    sys.stderr.write(f"ERROR: {e}\n")
    sys.exit(2)


if __name__ == "__main__":
  main()
