'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');

test('renderer imports a mobile database, renders analytics and exports a compatible project', () => {
  const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://tonnage.local/' });
  const { window } = dom;
  window.alert = () => {};
  window.confirm = () => true;
  window.crypto.randomUUID = () => 'test-uuid';
  window.eval(fs.readFileSync(path.join(root, 'src', 'data-format.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'src', 'analytics-core.js'), 'utf8'));
  const inline = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).filter(code => code.trim());
  for (const code of inline) window.eval(code);

  const database = {
    format: 'tonnage-database', formatVersion: 1, createdAt: '2026-01-02T12:00:00.000Z',
    source: { platform: 'android', appVersion: '0.10.0' },
    planning: {
      folders: [{ key: 'folder-1', name: 'База', sortOrder: 0 }],
      exercises: [{ key: 'bench-key', name: 'Жим', muscleGroup: 'Грудь', factor: 1, folderKey: 'folder-1' }],
      plans: [{ key: 'plan-a', name: 'День А', items: [{ exerciseKey: 'bench-key', setCount: 3, sortOrder: 0 }] }],
      schedule: [{ dateKey: '2026-01-05', planKey: 'plan-a' }]
    },
    database: {
      folders: [{ key: 'folder-1', name: 'База', sortOrder: 0 }],
      exercises: [{ id: 1, externalKey: 'bench-key', name: 'Жим', muscleGroup: 'Грудь', factor: 1, folderKey: 'folder-1', folderName: 'База' }],
      workouts: [{ id: 1, startedAt: '2026-01-01T10:00:00.000Z', finishedAt: '2026-01-01T11:00:00.000Z', totalVolume: 500 }],
      sets: [{ id: 1, workoutId: 1, exerciseId: 1, exerciseName: 'Жим', setNumber: 1, weight: 50, reps: 10, factor: 1 }]
    }
  };

  assert.equal(window.TonnageStaff.importText(JSON.stringify(database), 'phone.tonnage-db'), 'database');
  const snapshot = window.TonnageStaff.snapshot();
  assert.equal(snapshot.folders.length, 1);
  assert.equal(snapshot.exercises.length, 1);
  assert.equal(snapshot.plans.length, 1);
  assert.equal(snapshot.schedule.length, 1);
  assert.match(window.document.querySelector('#statsRoot').textContent, /500 кг/);

  window.document.querySelector('#recipientName').value = 'Игорь';
  window.document.querySelector('#recipientName').dispatchEvent(new window.Event('input', { bubbles: true }));
  window.document.querySelector('#projectName').value = 'Силовой цикл';
  window.document.querySelector('#projectName').dispatchEvent(new window.Event('input', { bubbles: true }));
  const output = JSON.parse(window.TonnageStaff.exportPlanning());
  assert.equal(output.format, 'tonnage-planning');
  assert.equal(output.formatVersion, 2);
  assert.equal(output.recipient.name, 'Игорь');
  assert.equal(output.recipient.project, 'Силовой цикл');
  assert.equal(output.data.plans[0].items[0].setCount, 3);
  dom.window.close();
});
