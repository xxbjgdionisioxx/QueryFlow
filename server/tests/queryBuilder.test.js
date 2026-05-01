/**
 * queryBuilder.test.js — Unit tests for the query builder modules
 *
 * Tests cover:
 *   - SELECT clause generation
 *   - JOIN clause generation
 *   - WHERE clause generation (conditions, groups, AND/OR)
 *   - GROUP BY / ORDER BY / LIMIT generation
 *   - Version compatibility adaptation (CTE rewrite warnings, window fn removal)
 */

import { describe, it, expect } from 'vitest';
import { buildSelect, escapeIdentifier } from '../src/queryBuilder/selectBuilder.js';
import { buildJoins }                    from '../src/queryBuilder/joinBuilder.js';
import { buildFilter }                   from '../src/queryBuilder/filterBuilder.js';
import { buildGroupBy, buildOrderBy, buildLimit } from '../src/queryBuilder/aggregationBuilder.js';
import { buildQuery, validateQueryDef }  from '../src/queryBuilder/index.js';

// ── escapeIdentifier ──────────────────────────────────────────────────────────

describe('escapeIdentifier', () => {
  it('wraps normal identifiers in backticks', () => {
    expect(escapeIdentifier('users')).toBe('`users`');
  });

  it('allows * to pass through unescaped', () => {
    expect(escapeIdentifier('*')).toBe('*');
  });

  it('escapes backticks inside identifier names', () => {
    expect(escapeIdentifier('my`table')).toBe('`my``table`');
  });
});

// ── buildSelect ───────────────────────────────────────────────────────────────

describe('buildSelect', () => {
  it('returns * when no columns provided', () => {
    expect(buildSelect([])).toBe('*');
    expect(buildSelect(null)).toBe('*');
  });

  it('builds a plain column reference', () => {
    const sql = buildSelect([{ table: 'users', column: 'id' }]);
    expect(sql).toBe('`users`.`id`');
  });

  it('builds a column with alias', () => {
    const sql = buildSelect([{ table: 'users', column: 'id', alias: 'user_id' }]);
    expect(sql).toBe('`users`.`id` AS `user_id`');
  });

  it('builds aggregate functions', () => {
    const sql = buildSelect([{ table: 'orders', column: 'id', aggregate: 'COUNT' }]);
    expect(sql).toBe('COUNT(`orders`.`id`)');
  });

  it('builds COUNT DISTINCT', () => {
    const sql = buildSelect([{ table: 'orders', column: 'user_id', aggregate: 'COUNT', distinct: true }]);
    expect(sql).toBe('COUNT(DISTINCT `orders`.`user_id`)');
  });

  it('builds multiple columns', () => {
    const sql = buildSelect([
      { table: 'u', column: 'name' },
      { table: 'u', column: 'email' },
    ]);
    expect(sql).toBe('`u`.`name`, `u`.`email`');
  });
});

// ── buildJoins ────────────────────────────────────────────────────────────────

describe('buildJoins', () => {
  it('returns empty string for no joins', () => {
    expect(buildJoins([])).toBe('');
    expect(buildJoins(null)).toBe('');
  });

  it('builds a basic INNER JOIN', () => {
    const sql = buildJoins([{
      type: 'INNER',
      fromTable: 'users', fromColumn: 'id',
      toTable: 'orders', toColumn: 'user_id',
    }]);
    expect(sql).toBe('INNER JOIN `orders` ON `users`.`id` = `orders`.`user_id`');
  });

  it('builds a LEFT JOIN', () => {
    const sql = buildJoins([{
      type: 'LEFT',
      fromTable: 'users', fromColumn: 'id',
      toTable: 'profiles', toColumn: 'user_id',
    }]);
    expect(sql).toContain('LEFT JOIN');
  });

  it('uses table aliases when provided', () => {
    const sql = buildJoins([{
      type: 'INNER',
      fromTable: 'users', fromAlias: 'u', fromColumn: 'id',
      toTable: 'orders', toAlias: 'o', toColumn: 'user_id',
    }]);
    expect(sql).toBe('INNER JOIN `orders` AS `o` ON `u`.`id` = `o`.`user_id`');
  });

  it('defaults unrecognized join type to INNER', () => {
    const sql = buildJoins([{
      type: 'CROSS',
      fromTable: 'a', fromColumn: 'id',
      toTable: 'b', toColumn: 'a_id',
    }]);
    expect(sql).toContain('INNER JOIN');
  });
});

// ── buildFilter ───────────────────────────────────────────────────────────────

describe('buildFilter', () => {
  it('returns empty string and params for null filter', () => {
    const { sql, params } = buildFilter(null);
    expect(sql).toBe('');
    expect(params).toEqual([]);
  });

  it('builds a simple equality condition', () => {
    const { sql, params } = buildFilter({
      type: 'condition',
      table: 'users', column: 'status',
      operator: '=', value: 'active',
    });
    expect(sql).toBe('`users`.`status` = ?');
    expect(params).toEqual(['active']);
  });

  it('builds IS NULL condition with no params', () => {
    const { sql, params } = buildFilter({
      type: 'condition',
      table: 'users', column: 'deleted_at',
      operator: 'IS NULL',
    });
    expect(sql).toBe('`users`.`deleted_at` IS NULL');
    expect(params).toEqual([]);
  });

  it('builds IN condition', () => {
    const { sql, params } = buildFilter({
      type: 'condition',
      table: 'users', column: 'role',
      operator: 'IN', values: ['admin', 'editor'],
    });
    expect(sql).toBe('`users`.`role` IN (?, ?)');
    expect(params).toEqual(['admin', 'editor']);
  });

  it('builds LIKE condition', () => {
    const { sql, params } = buildFilter({
      type: 'condition',
      table: 'users', column: 'name',
      operator: 'LIKE', value: '%john%',
    });
    expect(sql).toBe('`users`.`name` LIKE ?');
    expect(params).toEqual(['%john%']);
  });

  it('builds AND group', () => {
    const { sql, params } = buildFilter({
      type: 'group', logic: 'AND',
      children: [
        { type: 'condition', table: 'u', column: 'active', operator: '=', value: 1 },
        { type: 'condition', table: 'u', column: 'age', operator: '>=', value: 18 },
      ],
    });
    expect(sql).toBe('(`u`.`active` = ? AND `u`.`age` >= ?)');
    expect(params).toEqual([1, 18]);
  });

  it('builds nested AND/OR groups', () => {
    const { sql } = buildFilter({
      type: 'group', logic: 'AND',
      children: [
        { type: 'condition', table: 'u', column: 'status', operator: '=', value: 'active' },
        {
          type: 'group', logic: 'OR',
          children: [
            { type: 'condition', table: 'u', column: 'role', operator: '=', value: 'admin' },
            { type: 'condition', table: 'u', column: 'role', operator: '=', value: 'editor' },
          ],
        },
      ],
    });
    expect(sql).toContain('AND');
    expect(sql).toContain('OR');
    expect(sql).toContain('(');
  });

  it('throws on invalid operator', () => {
    expect(() => buildFilter({
      type: 'condition', table: 'u', column: 'id',
      operator: 'DROP TABLE', value: 1,
    })).toThrow();
  });
});

// ── buildGroupBy / buildOrderBy / buildLimit ──────────────────────────────────

describe('buildGroupBy', () => {
  it('returns empty string for no group by', () => {
    expect(buildGroupBy([])).toBe('');
  });

  it('builds GROUP BY clause', () => {
    const sql = buildGroupBy([{ table: 'orders', column: 'status' }]);
    expect(sql).toBe('GROUP BY `orders`.`status`');
  });
});

describe('buildOrderBy', () => {
  it('returns empty string for no order by', () => {
    expect(buildOrderBy([])).toBe('');
  });

  it('builds ORDER BY with direction', () => {
    const sql = buildOrderBy([{ table: 'users', column: 'created_at', direction: 'DESC' }]);
    expect(sql).toBe('ORDER BY `users`.`created_at` DESC');
  });

  it('defaults to ASC for unrecognized direction', () => {
    const sql = buildOrderBy([{ table: 'u', column: 'name', direction: 'RANDOM' }]);
    expect(sql).toBe('ORDER BY `u`.`name` ASC');
  });
});

describe('buildLimit', () => {
  it('returns empty for no limit', () => {
    expect(buildLimit(null)).toBe('');
  });

  it('builds LIMIT without offset', () => {
    expect(buildLimit(100)).toBe('LIMIT 100');
  });

  it('builds LIMIT with OFFSET', () => {
    expect(buildLimit(50, 100)).toBe('LIMIT 50 OFFSET 100');
  });
});

// ── buildQuery (integration) ──────────────────────────────────────────────────

describe('buildQuery', () => {
  it('builds a minimal SELECT * query', () => {
    const { sql } = buildQuery({ primaryTable: { name: 'users' } });
    expect(sql).toContain('SELECT *');
    expect(sql).toContain('FROM `users`');
  });

  it('builds a full query with joins and filters', () => {
    const { sql, params } = buildQuery({
      primaryTable: { name: 'users', alias: 'u' },
      columns: [
        { table: 'u', column: 'name' },
        { table: 'o', column: 'id', aggregate: 'COUNT', alias: 'order_count' },
      ],
      joins: [{
        type: 'LEFT',
        fromTable: 'users', fromAlias: 'u', fromColumn: 'id',
        toTable: 'orders', toAlias: 'o', toColumn: 'user_id',
      }],
      filters: {
        type: 'condition', table: 'u', column: 'status', operator: '=', value: 'active',
      },
      groupBy: [{ table: 'u', column: 'id' }],
      orderBy: [{ table: 'o', column: 'id', direction: 'DESC', aggregate: 'COUNT' }],
      limit: 25,
    });

    expect(sql).toContain('SELECT');
    expect(sql).toContain('LEFT JOIN');
    expect(sql).toContain('WHERE');
    expect(sql).toContain('GROUP BY');
    expect(sql).toContain('LIMIT 25');
    expect(params).toContain('active');
  });

  it('throws for missing primaryTable', () => {
    expect(() => buildQuery({})).toThrow();
  });

  // ── Version compatibility ─────────────────────────────────────────────────

  it('removes window functions and warns for MySQL 5.6', () => {
    const compat56 = {
      windowFunctions: false,
      jsonFunctions: false,
      jsonFunctionsPartial: false,
      onlyFullGroupBy: false,
      tier: '5.6',
    };

    const { sql, warnings } = buildQuery({
      primaryTable: { name: 'orders' },
      columns: [
        { table: 'orders', column: 'id' },
        { table: 'orders', column: 'id', aggregate: 'ROW_NUMBER', alias: 'rn' },
      ],
    }, compat56);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('ROW_NUMBER');
    // The ROW_NUMBER column should be stripped
    expect(sql).not.toContain('ROW_NUMBER');
  });

  it('adds permissive GROUP BY warning for MySQL 5.6', () => {
    const compat56 = {
      windowFunctions: false,
      jsonFunctions: false,
      jsonFunctionsPartial: false,
      onlyFullGroupBy: false,
      groupByMode: 'permissive',
      tier: '5.6',
    };

    const { warnings } = buildQuery({
      primaryTable: { name: 'orders' },
      groupBy: [{ table: 'orders', column: 'status' }],
    }, compat56);

    expect(warnings.some((w) => w.includes('permissive'))).toBe(true);
  });

  it('no warnings for MySQL 8.0 with all features', () => {
    const compat80 = {
      windowFunctions: true,
      jsonFunctions: true,
      jsonFunctionsPartial: false,
      onlyFullGroupBy: true,
      tier: '8.0+',
    };

    const { warnings } = buildQuery({
      primaryTable: { name: 'users' },
      columns: [{ table: 'users', column: 'id', aggregate: 'ROW_NUMBER', alias: 'rn' }],
    }, compat80);

    expect(warnings).toEqual([]);
  });
});

// ── validateQueryDef ──────────────────────────────────────────────────────────

describe('validateQueryDef', () => {
  it('returns error for missing primaryTable', () => {
    const errors = validateQueryDef({});
    expect(errors).toContain('primaryTable.name is required');
  });

  it('returns errors for incomplete join definitions', () => {
    const errors = validateQueryDef({
      primaryTable: { name: 'users' },
      joins: [{ fromColumn: 'id' }],
    });
    expect(errors.some((e) => e.includes('toTable'))).toBe(true);
  });

  it('passes a valid minimal query def', () => {
    const errors = validateQueryDef({ primaryTable: { name: 'users' } });
    expect(errors).toEqual([]);
  });
});
