const path = require('path');

function extractBaseName(fileName) {
  const base = path.parse(String(fileName || '')).name;
  return base || '';
}

function normalizeSpaces(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPhaseToken(baseNameUpper) {
  const tokenPattern = /(EVT|DVT|PVT|MP|P\d+)/i;
  const boundaryPattern = /(^|[^A-Z0-9])((EVT|DVT|PVT|MP|P\d+))([^A-Z0-9]|$)/gi;

  const matches = [];
  let match;
  while ((match = boundaryPattern.exec(baseNameUpper)) !== null) {
    const token = match[2];
    const start = match.index + match[1].length;
    matches.push({ token, start });
  }

  if (matches.length === 0) {
    const fallback = baseNameUpper.match(tokenPattern);
    if (!fallback) return null;
    return fallback[1].toUpperCase();
  }

  matches.sort((a, b) => a.start - b.start);
  return matches[0].token.toUpperCase();
}

function parsePhaseFromFileName(fileName) {
  const base = extractBaseName(fileName);
  if (!base) return null;
  const upper = base.toUpperCase();
  const token = findPhaseToken(upper);
  if (!token) return null;
  if (/^P\d+$/.test(token)) {
    const boundary = new RegExp(`(^|[^A-Z0-9])(${token})([^A-Z0-9]|$)`, 'i');
    if (!boundary.test(upper)) return null;
  }
  if (['EVT', 'DVT', 'PVT', 'MP'].includes(token)) {
    const boundary = new RegExp(`(^|[^A-Z0-9])(${token})([^A-Z0-9]|$)`, 'i');
    if (!boundary.test(upper)) return null;
  }
  return token;
}

function deriveProjectKeyFromFileName(fileName) {
  const base = extractBaseName(fileName);
  const phase = parsePhaseFromFileName(fileName);
  if (!base) return '';
  if (!phase) return normalizeSpaces(base);

  const upper = base.toUpperCase();
  const boundaryPattern = /(^|[^A-Z0-9])((EVT|DVT|PVT|MP|P\d+))([^A-Z0-9]|$)/gi;
  let match;
  while ((match = boundaryPattern.exec(upper)) !== null) {
    const token = match[2]?.toUpperCase();
    if (token !== phase) continue;
    const start = match.index + (match[1]?.length || 0);
    const prefix = normalizeSpaces(base.slice(0, start));
    if (prefix) return prefix;
    break;
  }

  const tokenRegex = new RegExp(`([\\s_-]*)${phase}([\\s_-]*)`, 'ig');
  const withoutPhase = base.replace(tokenRegex, ' ');
  return normalizeSpaces(withoutPhase);
}

module.exports = {
  parsePhaseFromFileName,
  deriveProjectKeyFromFileName,
};
