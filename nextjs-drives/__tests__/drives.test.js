import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const seedPath = new URL('../lib/drives.seed.json', import.meta.url);

test('seed file contains drives', async () => {
  const original = await readFile(seedPath, 'utf8');
  const data = JSON.parse(original);
  assert.ok(Array.isArray(data));
  assert.ok(data.length >= 2);
});

test('can update notes and tags persistently', async () => {
  const original = await readFile(seedPath, 'utf8');
  const data = JSON.parse(original);

  data[0].notes = 'QA test note';
  data[0].tags = ['qa', 'nextjs'];

  await writeFile(seedPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  const reloaded = JSON.parse(await readFile(seedPath, 'utf8'));

  assert.equal(reloaded[0].notes, 'QA test note');
  assert.deepEqual(reloaded[0].tags, ['qa', 'nextjs']);

  await writeFile(seedPath, original, 'utf8');
});
