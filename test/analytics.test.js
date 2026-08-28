'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Analytics = require('../src/analytics-core.js');

function fixture() {
  return {
    createdAt: '2026-01-10T20:00:00.000Z',
    exercises: [
      { id: 1, name: 'Жим лёжа', muscleGroup: 'Грудь', factor: 1, folderName: 'База' },
      { id: 2, name: 'Присед', muscleGroup: 'Ноги', factor: 1, folderName: 'База' },
      { id: 3, name: 'Сгибание', muscleGroup: 'Руки', factor: 2, folderName: 'Изоляция' }
    ],
    workouts: [
      { id: 10, startedAt: '2026-01-01T10:00:00.000Z', finishedAt: '2026-01-01T11:00:00.000Z', totalVolume: 1000 },
      { id: 11, startedAt: '2026-01-08T10:00:00.000Z', finishedAt: '2026-01-08T10:30:00.000Z', totalVolume: 600 },
      { id: 12, startedAt: '2026-01-10T18:00:00.000Z', finishedAt: '2026-01-10T18:20:00.000Z', totalVolume: 200 }
    ],
    sets: [
      { id: 100, workoutId: 10, exerciseId: 1, exerciseName: 'Жим лёжа', setNumber: 1, weight: 50, reps: 10, factor: 1 },
      { id: 101, workoutId: 10, exerciseId: 2, exerciseName: 'Присед', setNumber: 1, weight: 100, reps: 5, factor: 1 },
      { id: 102, workoutId: 11, exerciseId: 1, exerciseName: 'Жим лёжа', setNumber: 1, weight: 60, reps: 5, factor: 1 },
      { id: 103, workoutId: 11, exerciseId: 1, exerciseName: 'Жим лёжа', setNumber: 2, weight: 60, reps: 5, factor: 1 },
      { id: 104, workoutId: 12, exerciseId: 3, exerciseName: 'Сгибание', setNumber: 1, weight: 10, reps: 10, factor: 2 }
    ]
  };
}

test('buildModel calculates core volume, duration, records and quality', () => {
  const model = Analytics.buildModel(fixture(), { range: 'all', now: '2026-01-10T20:00:00.000Z' });
  assert.equal(model.metrics.totalVolume, 1800);
  assert.equal(model.metrics.workouts, 3);
  assert.equal(model.metrics.sets, 5);
  assert.equal(model.metrics.reps, 35);
  assert.equal(model.metrics.totalDurationMinutes, 110);
  assert.equal(model.metrics.averageDurationMinutes, 110 / 3);
  assert.equal(model.quality.issueCount, 0);
  const bench = model.exerciseSummaries.find(row => row.name === 'Жим лёжа');
  assert.equal(bench.volume, 1100);
  assert.equal(bench.maxWeight, 60);
  assert.equal(Math.round(bench.estimated1RM * 10) / 10, 70);
  assert.equal(model.muscleSummaries.find(row => row.key === 'Ноги').value, 500);
});

test('filters combine date, muscle and exercise dimensions', () => {
  const all = Analytics.buildModel(fixture(), { range: 'all', now: '2026-01-10T20:00:00.000Z' });
  const benchKey = all.exerciseSummaries.find(row => row.name === 'Жим лёжа').key;
  const bench = Analytics.buildModel(fixture(), { range: '7', exercise: benchKey, now: '2026-01-10T20:00:00.000Z' });
  assert.equal(bench.metrics.totalVolume, 600);
  assert.equal(bench.metrics.workouts, 1);
  assert.equal(bench.metrics.sets, 2);
  const arms = Analytics.buildModel(fixture(), { range: 'all', muscle: 'Руки', now: '2026-01-10T20:00:00.000Z' });
  assert.equal(arms.metrics.totalVolume, 200);
  assert.equal(arms.metrics.workouts, 1);
});

test('CSV contains filtered set-level data', () => {
  const model = Analytics.buildModel(fixture(), { range: 'all', folder: 'Изоляция', now: '2026-01-10T20:00:00.000Z' });
  const csv = Analytics.setsCsv(model);
  assert.match(csv, /Расчётный 1ПМ/);
  assert.match(csv, /Сгибание/);
  assert.doesNotMatch(csv, /Присед/);
});
