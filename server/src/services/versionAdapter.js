/**
 * versionAdapter.js — MySQL version detection and feature compatibility mapping
 *
 * Parses the MySQL version string returned by `SELECT VERSION()` and produces
 * a structured feature compatibility map used throughout the query builder.
 *
 * Compatibility matrix:
 * ─────────────────────────────────────────────────────
 * Feature              5.6     5.7     8.0+
 * CTEs (WITH)          ❌       ❌       ✅
 * Window functions     ❌       ❌       ✅
 * JSON functions       ❌       ⚠️       ✅
 * ONLY_FULL_GROUP_BY   off     on      on
 * ROW_NUMBER()         ❌       ❌       ✅
 * ─────────────────────────────────────────────────────
 */

/**
 * Parse a MySQL version string into major/minor/patch components.
 * Handles strings like "5.7.38-log", "8.0.32", "8.0.32-mysql".
 *
 * @param {string} versionString — raw output of SELECT VERSION()
 * @returns {{ major: number, minor: number, patch: number, raw: string }}
 */
export function parseVersion(versionString) {
  const raw = String(versionString).trim();
  // Strip any suffix like "-log", "-community", "-mysql"
  const cleaned = raw.split('-')[0];
  const parts = cleaned.split('.').map(Number);

  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    raw,
  };
}

/**
 * Build a feature compatibility map from a parsed version object.
 *
 * @param {{ major: number, minor: number }} version
 * @returns {CompatibilityMap}
 *
 * @typedef {Object} CompatibilityMap
 * @property {boolean} ctes                 - Common Table Expressions (WITH clause)
 * @property {boolean} windowFunctions      - ROW_NUMBER, RANK, etc.
 * @property {boolean} jsonFunctions        - JSON_EXTRACT, JSON_ARRAYAGG, etc.
 * @property {boolean} jsonFunctionsPartial - Subset of JSON available (5.7)
 * @property {boolean} onlyFullGroupBy      - Whether ONLY_FULL_GROUP_BY is default on
 * @property {string}  groupByMode          - 'permissive' | 'strict'
 * @property {string}  tier                 - '5.6' | '5.7' | '8.0+'
 */
export function buildCompatibilityMap(version) {
  const { major, minor } = version;

  // MySQL 8.0+
  if (major >= 8) {
    return {
      ctes: true,
      windowFunctions: true,
      jsonFunctions: true,
      jsonFunctionsPartial: false,
      onlyFullGroupBy: true,
      groupByMode: 'strict',
      tier: '8.0+',
    };
  }

  // MySQL 5.7
  if (major === 5 && minor >= 7) {
    return {
      ctes: false,
      windowFunctions: false,
      jsonFunctions: true,        // Introduced in 5.7.8 (we treat 5.7 as partial)
      jsonFunctionsPartial: true,
      onlyFullGroupBy: true,
      groupByMode: 'strict',
      tier: '5.7',
    };
  }

  // MySQL 5.6 (and anything older — treat as most restrictive)
  return {
    ctes: false,
    windowFunctions: false,
    jsonFunctions: false,
    jsonFunctionsPartial: false,
    onlyFullGroupBy: false,
    groupByMode: 'permissive',
    tier: '5.6',
  };
}

/**
 * Convenience function: given a raw version string, return the full parsed
 * result and compatibility map together.
 *
 * @param {string} versionString
 * @returns {{ version: object, compat: CompatibilityMap }}
 */
export function analyzeVersion(versionString) {
  const version = parseVersion(versionString);
  const compat = buildCompatibilityMap(version);
  return { version, compat };
}
