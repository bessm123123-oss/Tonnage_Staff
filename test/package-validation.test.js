'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Format = require('../src/data-format.js');

test('planning v2 with recipient metadata remains a valid mobile package', () => {
  const payload = {
    format: 'tonnage-planning',
    formatVersion: 2,
    createdAt: new Date().toISOString(),
    source: { platform: 'windows', appVersion: 'staff-0.5.0' },
    recipient: { name: 'Игорь', coach: 'Тренер', project: 'Цикл', note: 'Без отказа' },
    data: { folders: [], exercises: [], plans: [], schedule: [] }
  };
  const result = Format.parseAndValidate(`\uFEFF${JSON.stringify(payload)}`);
  assert.equal(result.type, 'planning');
  assert.equal(result.raw.recipient.name, 'Игорь');
});

test('mobile database v1 is accepted and malformed data is rejected', () => {
  const database = {
    format: 'tonnage-database', formatVersion: 1, planning: {},
    database: { folders: [], exercises: [], workouts: [], sets: [] }
  };
  assert.equal(Format.parseAndValidate(JSON.stringify(database)).type, 'database');
  assert.throws(() => Format.parseAndValidate('{broken'), /JSON/);
  assert.throws(() => Format.parseAndValidate('{}'), /поддерживается/);
});

test('filenames are safe on Windows', () => {
  assert.equal(Format.safeFilename('Игорь: цикл / 8 недель', 'fallback'), 'Игорь-цикл-8-недель');
  assert.equal(Format.safeFilename('***', 'fallback'), 'fallback');
});
