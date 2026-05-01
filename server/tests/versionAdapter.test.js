/**
 * versionAdapter.test.js — Unit tests for the MySQL version adapter
 */

import { describe, it, expect } from 'vitest';
import { parseVersion, buildCompatibilityMap, analyzeVersion } from '../src/services/versionAdapter.js';

describe('parseVersion', () => {
  it('parses MySQL 5.6.x', () => {
    const v = parseVersion('5.6.51');
    expect(v.major).toBe(5);
    expect(v.minor).toBe(6);
    expect(v.patch).toBe(51);
    expect(v.raw).toBe('5.6.51');
  });

  it('parses MySQL 5.7.x with suffix', () => {
    const v = parseVersion('5.7.38-log');
    expect(v.major).toBe(5);
    expect(v.minor).toBe(7);
    expect(v.patch).toBe(38);
  });

  it('parses MySQL 8.0.x', () => {
    const v = parseVersion('8.0.32');
    expect(v.major).toBe(8);
    expect(v.minor).toBe(0);
    expect(v.patch).toBe(32);
  });

  it('parses MySQL 8.0.x with community suffix', () => {
    const v = parseVersion('8.0.32-mysql');
    expect(v.major).toBe(8);
    expect(v.minor).toBe(0);
  });

  it('handles edge case version strings gracefully', () => {
    const v = parseVersion('5');
    expect(v.major).toBe(5);
    expect(v.minor).toBe(0);
    expect(v.patch).toBe(0);
  });
});

describe('buildCompatibilityMap', () => {
  it('returns correct map for MySQL 5.6', () => {
    const compat = buildCompatibilityMap({ major: 5, minor: 6 });
    expect(compat.ctes).toBe(false);
    expect(compat.windowFunctions).toBe(false);
    expect(compat.jsonFunctions).toBe(false);
    expect(compat.jsonFunctionsPartial).toBe(false);
    expect(compat.onlyFullGroupBy).toBe(false);
    expect(compat.groupByMode).toBe('permissive');
    expect(compat.tier).toBe('5.6');
  });

  it('returns correct map for MySQL 5.7', () => {
    const compat = buildCompatibilityMap({ major: 5, minor: 7 });
    expect(compat.ctes).toBe(false);
    expect(compat.windowFunctions).toBe(false);
    expect(compat.jsonFunctions).toBe(true);
    expect(compat.jsonFunctionsPartial).toBe(true);
    expect(compat.onlyFullGroupBy).toBe(true);
    expect(compat.groupByMode).toBe('strict');
    expect(compat.tier).toBe('5.7');
  });

  it('returns correct map for MySQL 8.0+', () => {
    const compat = buildCompatibilityMap({ major: 8, minor: 0 });
    expect(compat.ctes).toBe(true);
    expect(compat.windowFunctions).toBe(true);
    expect(compat.jsonFunctions).toBe(true);
    expect(compat.jsonFunctionsPartial).toBe(false);
    expect(compat.onlyFullGroupBy).toBe(true);
    expect(compat.groupByMode).toBe('strict');
    expect(compat.tier).toBe('8.0+');
  });

  it('treats MySQL 5.5 as 5.6-equivalent (most restrictive)', () => {
    const compat = buildCompatibilityMap({ major: 5, minor: 5 });
    expect(compat.tier).toBe('5.6');
    expect(compat.ctes).toBe(false);
    expect(compat.windowFunctions).toBe(false);
  });

  it('treats MySQL 9.x as 8.0+ (most permissive)', () => {
    const compat = buildCompatibilityMap({ major: 9, minor: 0 });
    expect(compat.tier).toBe('8.0+');
    expect(compat.ctes).toBe(true);
  });
});

describe('analyzeVersion', () => {
  it('returns both parsed version and compat map', () => {
    const result = analyzeVersion('8.0.32');
    expect(result.version.major).toBe(8);
    expect(result.compat.ctes).toBe(true);
    expect(result.compat.tier).toBe('8.0+');
  });

  it('correctly analyzes a 5.7 version string', () => {
    const result = analyzeVersion('5.7.38-log');
    expect(result.version.minor).toBe(7);
    expect(result.compat.windowFunctions).toBe(false);
    expect(result.compat.jsonFunctionsPartial).toBe(true);
  });
});
