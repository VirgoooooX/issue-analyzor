import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_BASE = "http://localhost:3000";

const env = {
  base: process.env.ISSUE_ANALYZOR_BASE || DEFAULT_BASE,
  username: process.env.ISSUE_ANALYZOR_USERNAME,
  password: process.env.ISSUE_ANALYZOR_PASSWORD,
};

let cachedToken = null;
let cachedTokenAt = 0;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function normalizeCsv(value) {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return s;
}

function buildUrl(base, path, params) {
  const u = new URL(path, base.endsWith("/") ? base : base + "/");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      const sv = String(v);
      if (!sv) continue;
      u.searchParams.set(k, sv);
    }
  }
  return u.toString();
}

async function httpJson(method, url, { headers, body } = {}) {
  const h = { Accept: "application/json", ...(headers || {}) };
  const init = { method, headers: h };
  if (body !== undefined) {
    h["Content-Type"] = "application/json; charset=utf-8";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const msg = typeof parsed === "object" && parsed && parsed.error ? parsed.error.message : res.statusText;
    const code = typeof parsed === "object" && parsed && parsed.error ? parsed.error.code : String(res.status);
    const err = new Error(`${code}: ${msg}`);
    err.status = res.status;
    err.payload = parsed;
    throw err;
  }
  return parsed;
}

async function login(force = false) {
  const now = Date.now();
  if (!force && cachedToken && now - cachedTokenAt < 60 * 60 * 1000) return cachedToken;

  const username = requireEnv("ISSUE_ANALYZOR_USERNAME", env.username);
  const password = requireEnv("ISSUE_ANALYZOR_PASSWORD", env.password);
  const url = buildUrl(env.base, "/api/auth/login");
  const data = await httpJson("POST", url, { body: { username, password } });
  const token = data?.data?.token;
  if (!token) throw new Error("Login failed: token missing in response");
  cachedToken = token;
  cachedTokenAt = now;
  return token;
}

async function apiGet(path, params) {
  const token = await login(false);
  const url = buildUrl(env.base, path, params);
  try {
    const data = await httpJson("GET", url, { headers: { Authorization: `Bearer ${token}` } });
    if (!data || data.success !== true) throw new Error("Unexpected response");
    return data.data;
  } catch (e) {
    if (e && (e.status === 401 || e.status === 403)) {
      const token2 = await login(true);
      const data2 = await httpJson("GET", url, { headers: { Authorization: `Bearer ${token2}` } });
      if (!data2 || data2.success !== true) throw new Error("Unexpected response");
      return data2.data;
    }
    throw e;
  }
}

function unwrapProjectsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.projects)) return payload.projects;
    if (payload.data && typeof payload.data === "object") {
      if (Array.isArray(payload.data.projects)) return payload.data.projects;
      if (payload.data.data && typeof payload.data.data === "object" && Array.isArray(payload.data.data.projects)) return payload.data.data.projects;
    }
  }
  return null;
}

async function listProjects(params = {}) {
  const pageSize = Number(params?.limit || 200);
  const status = params?.status || "active";
  let page = Number(params?.page || 1);
  const out = [];

  for (;;) {
    const data = await apiGet("/api/projects", { page, limit: pageSize, status });
    const rows = unwrapProjectsPayload(data);
    if (!rows) {
      const shape =
        data && typeof data === "object"
          ? `keys=${Object.keys(data).join(",")}; type.projects=${Array.isArray(data?.projects) ? "array" : typeof data?.projects}`
          : `type=${typeof data}`;
      throw new Error(`projects payload is not a list (${shape})`);
    }
    out.push(...rows);

    const total = typeof data === "object" && data ? Number(data.total || 0) : 0;
    if (!Number.isFinite(total) || total <= 0) break;
    if (out.length >= total) break;
    if (rows.length < pageSize) break;
    page += 1;
  }

  return out;
}

async function listProjectsAll() {
  const active = await listProjects({ status: "active" });
  const archived = await listProjects({ status: "archived" });
  return [...active, ...archived];
}

function parseUploadTime(s) {
  if (!s) return 0;
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : 0;
}

function selectProject(projects, { projectId, projectKey, phase, nameContains } = {}) {
  if (!Array.isArray(projects)) throw new Error("projects payload is not a list");
  if (projectId !== undefined && projectId !== null) {
    const found = projects.find((p) => String(p?.id) === String(projectId));
    if (!found) throw new Error(`projectId not found: ${projectId}`);
    return found;
  }

  const norm = (v) => String(v || "").trim().toLowerCase();
  const wantKey = projectKey ? norm(projectKey) : "";
  const wantPhase = phase ? norm(phase) : "";
  const wantNameContains = nameContains ? norm(nameContains) : "";

  let candidates = projects.slice();

  const exact = (p) => String(p?.project_key || "").trim() === String(projectKey || "").trim() && String(p?.phase || "").trim() === String(phase || "").trim();

  if (projectKey && phase) {
    candidates = candidates.filter((p) => exact(p));
    if (candidates.length === 0) {
      candidates = projects.filter((p) => norm(p?.project_key) === wantKey && norm(p?.phase) === wantPhase);
    }
    if (candidates.length === 0) {
      candidates = projects.filter((p) => norm(p?.name).includes(wantKey) && norm(p?.phase) === wantPhase);
    }
  } else if (projectKey) {
    candidates = candidates.filter((p) => norm(p?.project_key) === wantKey || norm(p?.name).includes(wantKey));
  } else if (phase) {
    candidates = candidates.filter((p) => norm(p?.phase) === wantPhase);
  }

  if (wantNameContains) {
    candidates = candidates.filter((p) => norm(p?.name).includes(wantNameContains));
  }

  if (candidates.length === 0) {
    if (projectKey && phase) {
      const byKey = projects.filter((p) => norm(p?.project_key) === wantKey || norm(p?.name).includes(wantKey));
      const phases = Array.from(new Set(byKey.map((p) => String(p?.phase || "").trim()).filter(Boolean))).sort();
      const sample = byKey
        .slice()
        .sort((a, b) => parseUploadTime(b?.upload_time) - parseUploadTime(a?.upload_time))
        .slice(0, 6)
        .map((p) => `${p?.project_key || ""}|${p?.phase || ""} (id=${p?.id})`)
        .join(", ");
      const msg = phases.length
        ? `No project matched selection criteria (projectKey=${projectKey}, phase=${phase}). Available phases for this projectKey: ${phases.join(", ")}. Latest snapshots: ${sample}`
        : `No project matched selection criteria (projectKey=${projectKey}, phase=${phase}). This projectKey was not found in active/archived projects.`;
      throw new Error(msg);
    }
    throw new Error("No project matched selection criteria");
  }

  candidates.sort((a, b) => {
    const ta = parseUploadTime(a?.upload_time);
    const tb = parseUploadTime(b?.upload_time);
    if (tb !== ta) return tb - ta;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
  return candidates[0];
}

function selectLatestProject(projects, { projectKey, phase, nameContains } = {}) {
  const candidates = projects.slice();
  let filtered = candidates;
  if (projectKey) filtered = filtered.filter((p) => String(p?.project_key || "").trim() === String(projectKey).trim());
  if (phase) filtered = filtered.filter((p) => String(p?.phase || "").trim() === String(phase).trim());
  if (nameContains) filtered = filtered.filter((p) => String(p?.name || "").toLowerCase().includes(String(nameContains).trim().toLowerCase()));
  if (filtered.length === 0) filtered = candidates;
  filtered.sort((a, b) => {
    const ta = parseUploadTime(a?.upload_time);
    const tb = parseUploadTime(b?.upload_time);
    if (tb !== ta) return tb - ta;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
  return filtered[0];
}

const PROJECT_SELECT_ALIASES = {
  projectId: "projectId",
  project_id: "projectId",
  id: "projectId",
  projectKey: "projectKey",
  project_key: "projectKey",
  phase: "phase",
  nameContains: "nameContains",
  name_contains: "nameContains",
  name: "nameContains",
};

function normalizeProjectSelectInput(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input)) {
    const mapped = PROJECT_SELECT_ALIASES[k];
    if (!mapped) continue;
    if (v === undefined || v === null) continue;
    out[mapped] = v;
  }
  return out;
}

const FILTER_KEY_ALIASES = {
  dateFrom: "date_from",
  dateTo: "date_to",
  sampleStatuses: "sample_statuses",
  failedTests: "failed_tests",
  testIds: "test_ids",
  failureTypes: "failure_types",
  functionCosmetic: "function_cosmetic",
  failedLocations: "failed_locations",
  faStatuses: "fa_statuses",
  unitNumber: "unit_number",
  faSearch: "fa_search",
  sortBy: "sort_by",
  sortOrder: "sort_order",
  include_trend: "includeTrend",
};

const FiltersSchema = z
  .object({
    date_from: z.string().optional(),
    date_to: z.string().optional(),
    priorities: z.string().optional(),
    sample_statuses: z.string().optional(),
    departments: z.string().optional(),
    wfs: z.string().optional(),
    configs: z.string().optional(),
    failed_tests: z.string().optional(),
    test_ids: z.string().optional(),
    failure_types: z.string().optional(),
    function_cosmetic: z.string().optional(),
    failed_locations: z.string().optional(),
    symptoms: z.string().optional(),
    fa_statuses: z.string().optional(),
    unit_number: z.string().optional(),
    sn: z.string().optional(),
    fa_search: z.string().optional(),
    page: z.number().int().optional(),
    limit: z.number().int().optional(),
    sort_by: z.string().optional(),
    sort_order: z.string().optional(),
    includeTrend: z.boolean().optional(),
  })
  .partial()
  .passthrough();

const PhaseSchema = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

const PhasesSchema = z
  .union([PhaseSchema, z.array(PhaseSchema)])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    const arr = Array.isArray(v) ? v : [v];
    const out = arr.map((x) => String(x).trim()).filter(Boolean);
    return out.length ? out : undefined;
  });

function uniq(arr) {
  return Array.from(new Set(arr));
}

function normalizeList(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function summarizeSampleSizes(sampleSizes) {
  const wfMap = {};
  const testToWFs = {};
  sampleSizes.forEach((row) => {
    const wf = row?.waterfall != null ? String(row.waterfall).trim() : "";
    if (!wf) return;
    if (!wfMap[wf]) wfMap[wf] = { wf, totalSamples: 0, configTotalSamples: {} };
    const cfg = row?.config_samples || {};
    Object.entries(cfg).forEach(([k, v]) => {
      const key = String(k || "").trim();
      if (!key) return;
      const num = Number(v) || 0;
      wfMap[wf].configTotalSamples[key] = (wfMap[wf].configTotalSamples[key] || 0) + num;
      wfMap[wf].totalSamples += num;
    });
    const tests = Array.isArray(row?.tests) ? row.tests : [];
    tests.forEach((t) => {
      const tn = String(t?.testName || "").trim();
      if (!tn) return;
      if (!testToWFs[tn]) testToWFs[tn] = new Set();
      testToWFs[tn].add(wf);
    });
  });

  const wfTotals = Object.values(wfMap).map((x) => ({ wf: x.wf, totalSamples: x.totalSamples }));
  const globalTotalSamples = wfTotals.reduce((sum, x) => sum + (Number(x.totalSamples) || 0), 0);
  const configTotalSamples = {};
  Object.values(wfMap).forEach((x) => {
    Object.entries(x.configTotalSamples).forEach(([cfg, n]) => {
      configTotalSamples[cfg] = (configTotalSamples[cfg] || 0) + (Number(n) || 0);
    });
  });
  const wfConfigTotals = Object.fromEntries(Object.values(wfMap).map((x) => [x.wf, x.configTotalSamples]));
  const testWFs = {};
  Object.entries(testToWFs).forEach(([tn, set]) => {
    testWFs[tn] = Array.from(set).sort((a, b) => Number(a) - Number(b));
  });

  return { globalTotalSamples, wfTotals, configTotalSamples, wfConfigTotals, testWFs };
}

function configDenomsForTest(sampleSizeSummary, testName) {
  const wfConfigTotals = sampleSizeSummary?.wfConfigTotals || {};
  const testWFs = sampleSizeSummary?.testWFs || {};
  const wfs = testName ? testWFs[testName] || [] : [];
  const denoms = {};
  wfs.forEach((wf) => {
    const cfg = wfConfigTotals[String(wf)] || {};
    Object.entries(cfg).forEach(([k, v]) => {
      const key = String(k || "").trim();
      if (!key) return;
      denoms[key] = (denoms[key] || 0) + (Number(v) || 0);
    });
  });
  const total = Object.values(denoms).reduce((s, n) => s + (Number(n) || 0), 0);
  return { wfs, denoms, total };
}

function buildConfigDenomsFromSampleSizes(sampleSizes, testName) {
  const wfsWithTest = new Set();
  (sampleSizes || []).forEach((row) => {
    const wf = row?.waterfall != null ? String(row.waterfall).trim() : "";
    if (!wf) return;
    const tests = Array.isArray(row?.tests) ? row.tests : [];
    if (tests.some((t) => String(t?.testName || "").trim() === testName)) {
      wfsWithTest.add(wf);
    }
  });
  const denoms = {};
  (sampleSizes || []).forEach((row) => {
    const wf = row?.waterfall != null ? String(row.waterfall).trim() : "";
    if (!wf || !wfsWithTest.has(wf)) return;
    const cfg = row?.config_samples || {};
    Object.entries(cfg).forEach(([k, v]) => {
      const key = String(k || "").trim();
      if (!key) return;
      denoms[key] = (denoms[key] || 0) + (Number(v) || 0);
    });
  });
  const total = Object.values(denoms).reduce((s, n) => s + (Number(n) || 0), 0);
  return { wfs: Array.from(wfsWithTest).sort((a, b) => Number(a) - Number(b)), denoms, total };
}

const ProjectSelectSchema = z
  .object({
    projectId: z.number().int().optional(),
    project_id: z.number().int().optional(),
    id: z.number().int().optional(),
    projectKey: z.string().optional(),
    project_key: z.string().optional(),
    phase: z.string().optional(),
    nameContains: z.string().optional(),
    name_contains: z.string().optional(),
    name: z.string().optional(),
  })
  .partial()
  .passthrough();

function mergeFilters(filters, extra) {
  const out = {};
  const src = { ...(filters || {}), ...(extra || {}) };
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null) continue;
    const key = FILTER_KEY_ALIASES[k] || k;
    if (typeof v === "boolean") out[key] = v ? "true" : "false";
    else out[key] = normalizeCsv(v);
  }
  return out;
}

async function resolveProjectId(select) {
  const input = normalizeProjectSelectInput(select);
  const projects = await listProjects({});
  try {
    return selectProject(projects, input).id;
  } catch (e) {
    if (input.projectKey || input.phase || input.nameContains) {
      const all = await listProjectsAll();
      return selectProject(all, input).id;
    }
    throw e;
  }
}

function response(content, structuredContent) {
  return {
    content: [{ type: "text", text: content }],
    structuredContent,
  };
}

const server = new McpServer({ name: "issue-analyzor-mcp", version: "0.1.0" });

const contextCache = new Map();
function makeContextId() {
  return `ctx_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
}
function cacheSet(id, value) {
  contextCache.set(id, { ...value, createdAt: Date.now() });
  while (contextCache.size > 50) {
    const firstKey = contextCache.keys().next().value;
    contextCache.delete(firstKey);
  }
}
function cacheGet(id) {
  const v = contextCache.get(id);
  if (!v) return null;
  if (Date.now() - (v.createdAt || 0) > 2 * 60 * 60 * 1000) {
    contextCache.delete(id);
    return null;
  }
  return v;
}

function pickFromOptions(options, key, includeValues = true) {
  const OPTION_KEY_ALIASES = {
    priorities: ["priorities", "priority"],
    sample_statuses: ["sample_statuses", "sampleStatuses", "sample_status", "sampleStatus"],
    departments: ["departments", "department"],
    wfs: ["wfs", "wf"],
    configs: ["configs", "config"],
    failed_tests: ["failed_tests", "failedTests", "failed_test", "failedTest"],
    test_ids: ["test_ids", "testIds", "test_id", "testId"],
    failure_types: ["failure_types", "failureTypes", "failure_type", "failureType"],
    function_cosmetic: ["function_cosmetic", "functionCosmetic", "function_or_cosmetic", "functionOrCosmetic"],
    failed_locations: ["failed_locations", "failedLocations", "failed_location", "failedLocation"],
    symptoms: ["symptoms", "symptom"],
    fa_statuses: ["fa_statuses", "faStatuses", "fa_status", "faStatus"],
  };

  const aliases = OPTION_KEY_ALIASES[key] || [key];
  const raw = aliases.map((k) => options?.[k]).find((v) => v !== undefined);
  const values = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Array.isArray(raw.values)
        ? raw.values
        : Array.isArray(raw.options)
          ? raw.options
          : null
      : null;
  if (!values) return { values: [], count: 0 };
  return { values: includeValues ? values : [], count: values.length };
}

server.registerTool(
  "issueanalyzor_prepare_context",
  {
    title: "Prepare Query Context (Step 1)",
    description: "Step 1/2. Resolve latest snapshots for phases, fetch filter options + sample size summaries, and return a contextId for step 2.",
    inputSchema: z
      .object({
        projectKey: z.string().optional(),
        project_key: z.string().optional(),
        phases: PhasesSchema,
        phase: PhaseSchema.optional(),
        nameContains: z.string().optional(),
        name_contains: z.string().optional(),
        name: z.string().optional(),
        vocabKeys: z.array(z.string()).optional(),
        vocabLimit: z.number().int().optional(),
        vocabContains: z.record(z.string(), z.string()).optional(),
        includeByPhase: z.boolean().optional(),
        includeSampleSize: z.boolean().optional(),
        cache: z.boolean().optional(),
      })
      .passthrough(),
  },
  async (input) => {
    const sel = normalizeProjectSelectInput(input);
    const projectKey = sel.projectKey;
    const nameContains = sel.nameContains;
    const phases = (input?.phases || input?.phase) ? normalizeList(input?.phases ?? input?.phase) : [];
    const phaseHint = phases.length ? phases : undefined;

    const vocabKeys = Array.isArray(input?.vocabKeys) && input.vocabKeys.length ? input.vocabKeys.map((k) => String(k).trim()).filter(Boolean) : ["failed_locations", "symptoms"];
    const vocabLimit = Number.isFinite(Number(input?.vocabLimit)) ? Math.max(1, Number(input.vocabLimit)) : 50;
    const vocabContains = input?.vocabContains && typeof input.vocabContains === "object" ? input.vocabContains : {};
    const includeByPhase = input?.includeByPhase === true;
    const includeSampleSize = input?.includeSampleSize !== false;
    const projects = await listProjects({});

    const snapshots = {};
    if (phaseHint && phaseHint.length) {
      for (const ph of phaseHint) {
        const p = selectProject(projects, { projectKey, phase: ph, nameContains });
        snapshots[ph] = p;
      }
    } else {
      const p = selectLatestProject(projects, { projectKey, nameContains });
      const ph = String(p?.phase || "latest").trim() || "latest";
      snapshots[ph] = p;
    }

    const effectivePhases = Object.keys(snapshots);

    const filterOptionsByPhase = {};
    const sampleSizeByPhase = {};

    for (const ph of effectivePhases) {
      const pid = snapshots[ph].id;
      const opts = await apiGet(`/api/projects/${pid}/filter-options`, {});
      filterOptionsByPhase[ph] = opts;

      if (includeSampleSize) {
        const ss = await apiGet(`/api/projects/${pid}/sample-sizes`, {});
        const summary = summarizeSampleSizes(ss || []);
        sampleSizeByPhase[ph] = summary;
      }
    }

    const allKeys = [
      "failed_locations",
      "symptoms",
      "configs",
      "wfs",
      "failed_tests",
      "test_ids",
      "fa_statuses",
      "failure_types",
      "function_cosmetic",
      "priorities",
      "sample_statuses",
      "departments",
    ];

    const unionAll = {};
    allKeys.forEach((k) => {
      unionAll[k] = uniq(effectivePhases.flatMap((ph) => pickFromOptions(filterOptionsByPhase[ph], k, true).values || []));
    });

    const unionCounts = Object.fromEntries(allKeys.map((k) => [k, unionAll[k].length]));

    const union = {};
    vocabKeys.forEach((k) => {
      const values = unionAll[k] || [];
      const needle = vocabContains[k] ? String(vocabContains[k]).trim().toLowerCase() : "";
      const filtered = needle ? values.filter((v) => String(v).toLowerCase().includes(needle)) : values;
      const limited = filtered.slice(0, vocabLimit);
      union[k] = limited;
    });

    const byPhase = includeByPhase
      ? Object.fromEntries(
          effectivePhases.map((ph) => {
            const opts = filterOptionsByPhase[ph] || {};
            const out = {};
            vocabKeys.forEach((k) => {
              const values = pickFromOptions(opts, k, true).values || [];
              const needle = vocabContains[k] ? String(vocabContains[k]).trim().toLowerCase() : "";
              const filtered = needle ? values.filter((v) => String(v).toLowerCase().includes(needle)) : values;
              out[k] = filtered.slice(0, vocabLimit);
            });
            return [ph, out];
          })
        )
      : undefined;

    const payload = {
      projectKey,
      phases: effectivePhases,
      snapshots,
      vocab: { union, unionCounts, ...(byPhase ? { byPhase } : {}) },
      sampleSize: includeSampleSize ? sampleSizeByPhase : undefined,
      semantics: {
        note: "Short phrases like 'IR Crack' should be structured as failed_locations='IR Lens' and symptoms='Crack' (domain convention).",
      },
    };

    const contextId = makeContextId();
    if (input?.cache !== false) cacheSet(contextId, payload);
    return response(_json({ contextId, ...payload }), { contextId });
  }
);

server.registerTool(
  "issueanalyzor_run_report",
  {
    title: "Run Report (Step 2)",
    description: "Step 2/2. Use contextId (from step 1) + structured filters to run analysis across phases and return a report-ready table.",
    inputSchema: z
      .object({
        contextId: z.string().optional(),
        context: z.any().optional(),
        filters: FiltersSchema.optional(),
        report: z
          .object({
            kind: z.enum(["phase_compare", "test_config_fr"]).default("phase_compare"),
            numerator: z.enum(["spec_strife_unique_sn", "spec_unique_sn"]).default("spec_unique_sn"),
          })
          .optional(),
      })
      .passthrough(),
  },
  async (input) => {
    const ctx = input?.contextId ? cacheGet(input.contextId) : input?.context;
    if (!ctx) throw new Error("Missing contextId or context");
    const phases = ctx.phases || [];
    const filters = mergeFilters(input?.filters || {}, {});
    const report = input?.report || { kind: "phase_compare", numerator: "spec_unique_sn" };

    if (report.kind === "phase_compare") {
      const rows = [];
      for (const ph of phases) {
        const pid = ctx.snapshots?.[ph]?.id;
        if (!pid) continue;
        const data = await apiGet(`/api/projects/${pid}/filter-statistics`, filters);
        const stats = data?.statistics;
        const totalSamples = Number(stats?.totalSamples || 0);
        const specSN = Number(stats?.specSNCount || 0);
        const strifeSN = Number(stats?.strifeSNCount || 0);
        const numerator = report.numerator === "spec_unique_sn" ? specSN : specSN + strifeSN;
        const frPpm = totalSamples > 0 ? Math.round((numerator / totalSamples) * 1_000_000) : 0;
        rows.push({
          phase: ph,
          projectId: pid,
          failuresSN: numerator,
          specSN,
          strifeSN,
          totalSamples,
          frPpm,
        });
      }

      rows.sort((a, b) => phases.indexOf(a.phase) - phases.indexOf(b.phase));
      const out = { contextId: input?.contextId, filters, report, table: rows };
      return response(_json(out), { contextId: input?.contextId });
    }

    if (report.kind === "test_config_fr") {
      const testName = String(filters.failed_tests || "").split(",")[0].trim();
      if (!testName) throw new Error("test_config_fr requires filters.failed_tests");

      const rows = [];
      for (const ph of phases) {
        const pid = ctx.snapshots?.[ph]?.id;
        if (!pid) continue;

        const data = await apiGet(`/api/projects/${pid}/filter-statistics`, filters);
        const stats = data?.statistics || {};
        const configDist = Array.isArray(stats.configDistribution) ? stats.configDistribution : [];

        let denomInfo = null;
        if (ctx.sampleSize?.[ph]?.wfConfigTotals) {
          denomInfo = configDenomsForTest(ctx.sampleSize[ph], testName);
        } else {
          const ss = await apiGet(`/api/projects/${pid}/sample-sizes`, {});
          denomInfo = buildConfigDenomsFromSampleSizes(ss || [], testName);
        }

        const denomByConfig = denomInfo?.denoms || {};
        const wfs = denomInfo?.wfs || [];

        configDist.forEach((row) => {
          const cfg = String(row?.config || "").trim();
          if (!cfg) return;
          const denom = Number(denomByConfig[cfg] || 0);
          const specSN = Number(row?.specSNCount || 0);
          const strifeSN = Number(row?.strifeSNCount || 0);
          const numerator = report.numerator === "spec_unique_sn" ? specSN : specSN + strifeSN;
          const frPpm = denom > 0 ? Math.round((numerator / denom) * 1_000_000) : 0;
          rows.push({
            phase: ph,
            projectId: pid,
            testName,
            config: cfg,
            denomSamples: denom,
            failuresSN: numerator,
            specSN,
            strifeSN,
            frPpm,
            wfs,
          });
        });
      }

      rows.sort((a, b) => {
        const pa = phases.indexOf(a.phase);
        const pb = phases.indexOf(b.phase);
        if (pa !== pb) return pa - pb;
        return (b.frPpm || 0) - (a.frPpm || 0);
      });
      const out = { contextId: input?.contextId, filters, report, table: rows };
      return response(_json(out), { contextId: input?.contextId });
    }

    throw new Error(`Unsupported report.kind: ${report.kind}`);
  }
);

server.registerTool(
  "issueanalyzor_projects_list",
  {
    title: "List Projects",
    description: "List uploaded project snapshots (projects table). Supports optional filtering and limiting.",
    inputSchema: {
      projectKey: z.string().optional(),
      project_key: z.string().optional(),
      phase: z.string().optional(),
      nameContains: z.string().optional(),
      name_contains: z.string().optional(),
      name: z.string().optional(),
      limit: z.number().int().optional(),
    },
  },
  async (input) => {
    const { projectKey, phase, nameContains, limit } = normalizeProjectSelectInput(input);
    const projects = await listProjects({});
    let rows = projects.slice();
    if (projectKey) rows = rows.filter((p) => String(p?.project_key || "").trim() === String(projectKey).trim());
    if (phase) rows = rows.filter((p) => String(p?.phase || "").trim() === String(phase).trim());
    if (nameContains) rows = rows.filter((p) => String(p?.name || "").toLowerCase().includes(String(nameContains).toLowerCase()));
    rows.sort((a, b) => parseUploadTime(b?.upload_time) - parseUploadTime(a?.upload_time));
    if (limit && limit > 0) rows = rows.slice(0, limit);
    return response(_json(rows), { count: rows.length });
  }
);

server.registerTool(
  "issueanalyzor_project_select",
  {
    title: "Select Project Snapshot",
    description: "Select a project snapshot by projectId, or choose the latest by projectKey/phase/nameContains.",
    inputSchema: ProjectSelectSchema,
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const projects = await listProjects({});
    const p = selectProject(projects, { projectId, projectKey, phase, nameContains });
    return response(_json(p), { projectId: p?.id });
  }
);

function _json(x) {
  return JSON.stringify(x);
}

const FormatSchema = z.enum(["csv", "json"]).optional();

function csvEscape(value) {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function toCsv(header, rows) {
  return [header.join(","), ...rows.map((r) => header.map((_, i) => csvEscape(r[i])).join(","))].join("\n");
}

function frCompactToCsv(data) {
  if (!data || typeof data !== "object") return "";
  if (String(data.groupBy || "none") === "none") return toCsv(["failures", "totalSamples"], [[data.failures || 0, data.totalSamples || 0]]);
  const keys = Array.isArray(data.keys) ? data.keys : [];
  const failures = Array.isArray(data.failures) ? data.failures : [];
  const totalSamples = data.totalSamples;
  const rows = keys.map((k, i) => [k, failures[i] || 0, Array.isArray(totalSamples) ? (totalSamples[i] || 0) : (totalSamples || 0)]);
  return toCsv(["key", "failures", "totalSamples"], rows);
}

function sampleSizeCompactToCsv(data) {
  if (!data || typeof data !== "object") return "";
  const keys = Array.isArray(data.keys) ? data.keys : [];
  const totalSamples = Array.isArray(data.totalSamples) ? data.totalSamples : [];
  const rows = keys.map((k, i) => [k, totalSamples[i] || 0]);
  return toCsv(["key", "totalSamples"], rows);
}

function distBundleToCsv(bundle) {
  if (!bundle || typeof bundle !== "object") return "";
  const rows = [];
  if (bundle.overview) rows.push(["overview", "all", "__all__", bundle.overview.failures || 0, bundle.overview.totalSamples || 0]);
  const dist = bundle.distributions && typeof bundle.distributions === "object" ? bundle.distributions : {};
  for (const [dimension, v] of Object.entries(dist)) {
    const keys = Array.isArray(v?.keys) ? v.keys : [];
    const failures = Array.isArray(v?.failures) ? v.failures : [];
    const totalSamples = v?.totalSamples;
    for (let i = 0; i < keys.length; i++) {
      rows.push(["dist", dimension, keys[i], failures[i] || 0, Array.isArray(totalSamples) ? (totalSamples[i] || 0) : (totalSamples || 0)]);
    }
  }
  return toCsv(["table", "dimension", "key", "failures", "totalSamples"], rows);
}

function frMatrixCompactToCsv(payload) {
  if (!payload || typeof payload !== "object") return "";
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  const configs = Array.isArray(payload.configs) ? payload.configs : [];
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const out = [];
  snapshots.forEach((s, i) => out.push(["snapshot", i, "", s, "", ""]));
  configs.forEach((c, i) => out.push(["config", "", i, c, "", ""]));
  rows.forEach((r) => out.push(["cell", r?.[0], r?.[1], "", r?.[2], r?.[3]]));
  return toCsv(["table", "snapshotIndex", "configIndex", "label", "failures", "totalSamples"], out);
}

function crossCompactToCsv(payload) {
  if (!payload || typeof payload !== "object") return "";
  const d1 = Array.isArray(payload.dimension1Values) ? payload.dimension1Values : [];
  const d2 = Array.isArray(payload.dimension2Values) ? payload.dimension2Values : [];
  const denom = Array.isArray(payload.denomByDim2) ? payload.denomByDim2 : [];
  const cells = Array.isArray(payload.cells) ? payload.cells : [];
  const out = [];
  d1.forEach((v, i) => out.push(["dim1", i, "", v, "", "", "", ""]));
  d2.forEach((v, j) => out.push(["dim2", "", j, v, denom[j] || 0, "", "", ""]));
  cells.forEach((c) => {
    const i = c?.[0];
    const j = c?.[1];
    const specSN = c?.[2] || 0;
    const strifeSN = c?.[3] || 0;
    const issues = c?.[4] || 0;
    const cellDenom = c?.length >= 6 ? (c?.[5] || 0) : "";
    out.push(["cell", i, j, "", cellDenom, specSN, strifeSN, issues]);
  });
  return toCsv(["table", "i", "j", "value", "totalSamples", "specSN", "strifeSN", "issuesCount"], out);
}

const ProjectQuerySchema = ProjectSelectSchema.extend({
  filters: FiltersSchema.optional(),
});

const CompactOptsSchema = z.object({
  compact: z.boolean().optional(),
  top: z.number().int().positive().optional(),
  numerator: z.enum(["spec", "strife", "both"]).optional(),
  sortBy: z.enum(["ppm", "failures", "key"]).optional(),
  format: FormatSchema,
});

server.registerTool(
  "issueanalyzor_sample_sizes",
  {
    title: "Get Sample Sizes",
    description: "Get sample sizes per WF, including tests and config_samples.",
    inputSchema: ProjectSelectSchema,
  },
  async (select) => {
    const pid = await resolveProjectId(select);
    const data = await apiGet(`/api/projects/${pid}/sample-sizes`, {});
    return response(_json(data), { projectId: pid });
  }
);

server.registerTool(
  "issueanalyzor_filter_statistics",
  {
    title: "Get Filter Statistics",
    description: "Get filter statistics. Use only when user explicitly wants distributions/top causes (failed_location etc). For FR-only questions, prefer issueanalyzor_fr_compact. Defaults to compact topK output; set compact=false for full response.",
    inputSchema: ProjectQuerySchema.merge(CompactOptsSchema),
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const filters = input?.filters;
    const compact = input?.compact !== false;
    const top = input?.top;
    const numerator = input?.numerator;
    const sortBy = input?.sortBy;
    const format = compact ? (input?.format || "csv") : "json";
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const params = mergeFilters(filters, compact ? { top, numerator, sortBy } : {});
    const path = compact ? `/api/projects/${pid}/filter-statistics-compact` : `/api/projects/${pid}/filter-statistics`;
    const data = await apiGet(path, params);
    const text = format === "csv" ? distBundleToCsv(data) : _json(data);
    return response(text, { projectId: pid, format, compact });
  }
);

const CompactFrSchema = ProjectSelectSchema.extend({
  groupBy: z.enum(["none", "config", "wf", "failed_test", "failed_location", "symptom"]).optional(),
  numerator: z.enum(["spec", "strife", "both"]).optional(),
  sortBy: z.enum(["ppm", "failures", "key"]).optional(),
  top: z.number().int().positive().optional(),
  keys: z.union([z.array(z.string()), z.string()]).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional(),
  filters: FiltersSchema.optional(),
  format: FormatSchema,
});

server.registerTool(
  "issueanalyzor_fr_compact",
  {
    title: "Get Compact Failure Rate",
    description: "Get compact failure counts (distinct SN) and total sample size; supports groupBy and pagination.",
    inputSchema: CompactFrSchema,
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const groupBy = input?.groupBy;
    const numerator = input?.numerator;
    const sortBy = input?.sortBy;
    const top = input?.top;
    const offset = input?.offset;
    const limit = input?.limit ?? (top ? Number(top) : undefined);
    const keys = input?.keys;
    const filters = input?.filters;
    const format = input?.format || "csv";
    const params = mergeFilters(filters, { groupBy, numerator, sortBy, offset: top ? 0 : offset, limit, keys });
    const data = await apiGet(`/api/projects/${pid}/fr-compact`, params);
    const text = format === "csv" ? frCompactToCsv(data) : _json(data);
    return response(text, { projectId: pid, format });
  }
);

const CompactSampleSchema = ProjectSelectSchema.extend({
  groupBy: z.enum(["failed_test", "wf", "config"]).optional(),
  top: z.number().int().positive().optional(),
  keys: z.union([z.array(z.string()), z.string()]).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional(),
  filters: FiltersSchema.optional(),
  format: FormatSchema,
});

server.registerTool(
  "issueanalyzor_sample_size_compact",
  {
    title: "Get Compact Sample Size",
    description: "Get compact sample size totals grouped by failed_test/wf/config with pagination.",
    inputSchema: CompactSampleSchema,
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const groupBy = input?.groupBy;
    const top = input?.top;
    const offset = input?.offset;
    const limit = input?.limit ?? (top ? Number(top) : undefined);
    const keys = input?.keys;
    const filters = input?.filters;
    const format = input?.format || "csv";
    const params = mergeFilters(filters, { groupBy, offset: top ? 0 : offset, limit, keys });
    const data = await apiGet(`/api/projects/${pid}/sample-size-compact`, params);
    const text = format === "csv" ? sampleSizeCompactToCsv(data) : _json(data);
    return response(text, { projectId: pid, format });
  }
);

const CompactFrMatrixSchema = z.object({
  snapshots: z.array(ProjectSelectSchema).min(1),
  numerator: z.enum(["spec", "strife", "both"]).optional(),
  configs: z.union([z.array(z.string()), z.string()]).optional(),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional(),
  filters: FiltersSchema.optional(),
  format: FormatSchema,
});

server.registerTool(
  "issueanalyzor_fr_matrix_compact",
  {
    title: "Get Compact FR Matrix (Snapshots × Configs)",
    description: "Get compact FR inputs for comparing multiple snapshots across many configs (paged).",
    inputSchema: CompactFrMatrixSchema,
  },
  async (input) => {
    const snapshots = input?.snapshots || [];
    const numerator = input?.numerator;
    const offset = input?.offset;
    const limit = input?.limit;
    const configs = input?.configs;
    const filters = input?.filters;
    const format = input?.format || "csv";

    const resolved = [];
    for (const s of snapshots) {
      const pid = await resolveProjectId(s);
      const norm = normalizeProjectSelectInput(s);
      const label = norm.projectId ? String(norm.projectId) : `${norm.projectKey || ""}|${norm.phase || ""}`;
      resolved.push({ projectId: pid, label });
    }

    let pageKeys = undefined;
    if (configs) pageKeys = Array.isArray(configs) ? configs : String(configs).split(",").map((v) => v.trim()).filter(Boolean);

    if (!pageKeys) {
      const first = resolved[0];
      const firstParams = mergeFilters(filters, { groupBy: "config", numerator, offset, limit });
      const firstData = await apiGet(`/api/projects/${first.projectId}/fr-compact`, firstParams);
      pageKeys = firstData?.keys || [];
    }

    const keyCsv = normalizeCsv(pageKeys);
    const rows = [];
    for (let si = 0; si < resolved.length; si++) {
      const { projectId, label } = resolved[si];
      const params = mergeFilters(filters, { groupBy: "config", numerator, keys: keyCsv });
      const data = await apiGet(`/api/projects/${projectId}/fr-compact`, params);
      const failures = data?.failures || [];
      const totalSamples = data?.totalSamples || [];
      for (let ci = 0; ci < pageKeys.length; ci++) {
        rows.push([si, ci, Number(failures[ci] || 0), Number(totalSamples[ci] || 0)]);
      }
      resolved[si] = { projectId, label, offset: data?.offset ?? 0, limit: data?.limit ?? pageKeys.length, totalKeys: data?.totalKeys ?? pageKeys.length };
    }

    const payload = { snapshots: resolved.map((s) => s.label), configs: pageKeys, rows };
    const text = format === "csv" ? frMatrixCompactToCsv(payload) : _json(payload);
    return response(text, { format });
  }
);

server.registerTool(
  "issueanalyzor_analysis",
  {
    title: "Get Analysis",
    description: "Get analysis. Use only when user explicitly wants top causes (symptom/wf/config/failed_test). For FR-only questions, prefer issueanalyzor_fr_compact. Defaults to compact topK output; set compact=false for full response.",
    inputSchema: ProjectQuerySchema.merge(CompactOptsSchema),
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const filters = input?.filters;
    const compact = input?.compact !== false;
    const top = input?.top;
    const numerator = input?.numerator;
    const sortBy = input?.sortBy;
    const format = compact ? (input?.format || "csv") : "json";
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const params = mergeFilters(filters, compact ? { top, numerator, sortBy } : {});
    const path = compact ? `/api/projects/${pid}/analysis-compact` : `/api/projects/${pid}/analysis`;
    const data = await apiGet(path, params);
    const text = format === "csv" ? distBundleToCsv(data) : _json(data);
    return response(text, { projectId: pid, format, compact });
  }
);

server.registerTool(
  "issueanalyzor_analysis_test",
  {
    title: "Get Test Analysis",
    description: "Get test dimension analysis under filters.",
    inputSchema: ProjectQuerySchema,
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const filters = input?.filters;
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const params = mergeFilters(filters, {});
    const data = await apiGet(`/api/projects/${pid}/analysis/test`, params);
    return response(_json(data), { projectId: pid });
  }
);

server.registerTool(
  "issueanalyzor_cross_analysis",
  {
    title: "Get Cross Analysis",
    description: "Get cross analysis for dimension1 × dimension2 under filters. Defaults to compact CSV output to minimize tokens; set compact=false for full response.",
    inputSchema: ProjectSelectSchema.extend({
      dimension1: z.string(),
      dimension2: z.string(),
      compact: z.boolean().optional(),
      top: z.number().int().nonnegative().optional(),
      sortBy: z.enum(["specSN", "strifeSN", "issues"]).optional(),
      format: FormatSchema,
      filters: FiltersSchema.optional(),
    }),
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const { dimension1, dimension2 } = input || {};
    const compact = input?.compact !== false;
    const top = input?.top;
    const sortBy = input?.sortBy;
    const format = compact ? (input?.format || "csv") : "json";
    const filters = input?.filters;
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const params = mergeFilters(filters, compact ? { dimension1, dimension2, top, sortBy } : { dimension1, dimension2 });
    const path = compact ? `/api/projects/${pid}/analysis/cross-compact` : `/api/projects/${pid}/analysis/cross`;
    const data = await apiGet(path, params);
    const payload = compact ? data?.crossAnalysis : data?.crossAnalysis;
    const text = format === "csv" ? crossCompactToCsv(payload) : _json(data);
    return response(text, { projectId: pid, format, compact });
  }
);

server.registerTool(
  "issueanalyzor_failure_matrix",
  {
    title: "Get Failure Rate Matrix",
    description: "Get WF×Test×Config failure rate matrix under filters.",
    inputSchema: ProjectQuerySchema,
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const filters = input?.filters;
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const params = mergeFilters(filters, {});
    const data = await apiGet(`/api/projects/${pid}/failure-rate-matrix`, params);
    return response(_json(data), { projectId: pid });
  }
);

server.registerTool(
  "issueanalyzor_issues_list",
  {
    title: "List Issues (Paged)",
    description: "List issues under filters with pagination (page/limit/sort_by/sort_order).",
    inputSchema: ProjectQuerySchema,
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const filters = input?.filters;
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const params = mergeFilters(filters, {});
    const data = await apiGet(`/api/projects/${pid}/issues`, params);
    return response(_json(data), { projectId: pid });
  }
);

server.registerTool(
  "issueanalyzor_filter_options",
  {
    title: "Get Filter Options",
    description: "Get filter options (distinct values) under currentFilters context.",
    inputSchema: ProjectQuerySchema,
  },
  async (input) => {
    const { projectId, projectKey, phase, nameContains } = normalizeProjectSelectInput(input);
    const filters = input?.filters;
    const pid = projectId ?? (await resolveProjectId({ projectKey, phase, nameContains }));
    const params = mergeFilters(filters, {});
    const data = await apiGet(`/api/projects/${pid}/filter-options`, params);
    const count = data && typeof data === "object" ? Object.values(data).reduce((s, v) => s + (Array.isArray(v) ? v.length : 0), 0) : 0;
    return response(_json(data), { projectId: pid, count });
  }
);

server.registerTool(
  "issueanalyzor_api_describe",
  {
    title: "Describe API Coverage",
    description: "Describe which Issue Analyzor HTTP APIs are wrapped by this MCP server and which filters are supported.",
    inputSchema: z.object({}).optional(),
  },
  async () => {
    const capabilities = {
      base: env.base,
      env: {
        ISSUE_ANALYZOR_BASE: true,
        ISSUE_ANALYZOR_USERNAME: !!env.username,
        ISSUE_ANALYZOR_PASSWORD: !!env.password,
      },
      tools: [
        "issueanalyzor_projects_list",
        "issueanalyzor_project_select",
        "issueanalyzor_sample_sizes",
        "issueanalyzor_sample_size_compact",
        "issueanalyzor_filter_statistics",
        "issueanalyzor_fr_compact",
        "issueanalyzor_fr_matrix_compact",
        "issueanalyzor_analysis",
        "issueanalyzor_analysis_test",
        "issueanalyzor_cross_analysis",
        "issueanalyzor_failure_matrix",
        "issueanalyzor_issues_list",
        "issueanalyzor_filter_options",
      ],
      filters: Object.keys(FiltersSchema.shape).sort(),
    };
    return response(_json(capabilities), {});
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(1);
});
