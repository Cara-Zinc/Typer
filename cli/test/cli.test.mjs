import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initVault, createChapter, loadIndex, saveEdited, recover, vaultAt } from '../lib/vault.mjs';
import { splitEditor } from '../lib/editor.mjs';

const executable = fileURLToPath(new URL('../bin/typer.mjs', import.meta.url));
const run = (root, args = [], extra = {}) => spawnSync(process.execPath, [executable, '--vault', root, ...args], {
  encoding: 'utf8', env: { ...process.env, VISUAL: '', EDITOR: '', TYPER_VAULT: '', ...extra.env }, ...extra,
});
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), 'typer-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return await initVault(root);
}
const chapterFile = (v, c) => path.join(v.drafts, c.filename);
async function assertOK(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result;
}
async function editorScript(v, source) {
  const file = path.join(v.root, 'fake editor.cjs');
  await fs.writeFile(file, source);
  return `"${process.execPath}" "${file}"`;
}

test('full writing workflow preserves desktop metadata, notes and manuscript order', async t => {
  const v = await fixture(t);
  const first = JSON.parse((await assertOK(run(v.root, ['chapter', 'new', 'First', '--json']))).stdout);
  const second = await createChapter(v, '第二章');
  const original = await loadIndex(v);
  await saveEdited(v, first.id, original.raw, '# First\n\n', '# First\n\nA quiet winter.\n');
  await fs.mkdir(path.join(v.drafts, '_notes'));
  const notes = path.join(v.drafts, '_notes', `${first.id}.json`);
  await fs.writeFile(notes, '{"version":1,"notes":[{"body":"keep me"}]}');
  await assertOK(run(v.root, ['chapter', 'rename', first.id, 'Opening']));
  await assertOK(run(v.root, ['chapter', 'move', second.id, '1']));
  const chapters = JSON.parse((await assertOK(run(v.root, ['chapter', 'list', '--json']))).stdout);
  assert.deepEqual(chapters.map(c => c.id), [second.id, first.id]);
  assert.equal(chapters[1].filename, first.filename);
  assert.equal(chapters[1].wordCount, 3);
  assert.match(await fs.readFile(notes, 'utf8'), /keep me/);
  const exported = (await assertOK(run(v.root, ['export']))).stdout;
  assert.equal(exported, '# 第二章\n\n---\n\n# Opening\n\nA quiet winter.\n');
  const dashboard = JSON.parse((await assertOK(run(v.root, ['dashboard', '--json']))).stdout);
  assert.equal(dashboard.words, 3);
  assert.equal(dashboard.chapters.length, 2);
  assert.equal((await loadIndex(v)).index.version, 1);
});

test('same title created twice gets distinct IDs and files', async t => {
  const v = await fixture(t), a = await createChapter(v, 'Same'), b = await createChapter(v, 'Same');
  assert.notEqual(a.id, b.id); assert.notEqual(a.filename, b.filename);
});

test('external editor accepts quoted paths, updates title/count and cleans temporary copy', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Before');
  const captured = path.join(v.root, 'edit-path');
  const command = await editorScript(v, `const fs=require('node:fs');const f=process.argv.at(-1);fs.writeFileSync(${JSON.stringify(captured)},f);fs.writeFileSync(f,'# After\\n\\nOne two three.\\n');`);
  await assertOK(run(v.root, ['edit', c.id, '--editor', command]));
  const chapters = JSON.parse(run(v.root, ['chapter', 'list', '--json']).stdout);
  assert.equal(chapters[0].title, 'After'); assert.equal(chapters[0].wordCount, 3);
  await assert.rejects(fs.stat(await fs.readFile(captured, 'utf8')), { code: 'ENOENT' });
});

test('editor failure leaves original unchanged and retains edited copy', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Before');
  const command = await editorScript(v, "require('node:fs').writeFileSync(process.argv.at(-1),'valuable work');process.exit(7);");
  const result = run(v.root, ['edit', c.id, '--editor', command]);
  assert.equal(result.status, 1); assert.match(result.stderr, /Editor exited 7/);
  const retained = result.stderr.match(/Edited copy retained at: (.+)/)[1];
  t.after(() => fs.rm(path.dirname(retained), { recursive: true, force: true }));
  assert.equal(await fs.readFile(retained, 'utf8'), 'valuable work');
  assert.equal(await fs.readFile(chapterFile(v, c), 'utf8'), '# Before\n\n');
});

test('editor detects a concurrent chapter change and preserves both versions', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Before');
  const command = await editorScript(v, `const fs=require('node:fs');fs.writeFileSync(process.argv.at(-1),'my edited text');fs.writeFileSync(${JSON.stringify(chapterFile(v,c))},'outside change');`);
  const result = run(v.root, ['edit', c.id, '--editor', command]);
  assert.equal(result.status, 1); assert.match(result.stderr, /Concurrent change/);
  const retained = result.stderr.match(/Edited copy retained at: (.+)/)[1];
  t.after(() => fs.rm(path.dirname(retained), { recursive: true, force: true }));
  assert.equal(await fs.readFile(retained, 'utf8'), 'my edited text');
  assert.equal(await fs.readFile(chapterFile(v, c), 'utf8'), 'outside change');
});

test('metadata changed during editing is not overwritten', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Before'), snapshot = await loadIndex(v);
  await createChapter(v, 'Another');
  await assert.rejects(saveEdited(v, c.id, snapshot.raw, '# Before\n\n', '# New\n\n'), /metadata changed/);
  assert.equal((await loadIndex(v)).index.chapters.length, 2);
});

test('editor parsing does not invoke a shell', () => {
  assert.deepEqual(splitEditor('"/my editor" --wait \'two words\''), ['/my editor', '--wait', 'two words']);
  assert.deepEqual(splitEditor('nano $(touch /tmp/unwanted)'), ['nano', '$(touch', '/tmp/unwanted)']);
  assert.throws(() => splitEditor('"unfinished'), /Unclosed/);
});

test('malformed index is an error and never replaced with an empty index', async t => {
  const v = await fixture(t), file = path.join(v.drafts, '_index.json');
  await fs.writeFile(file, '{broken');
  const r = run(v.root, ['chapter', 'new', 'Danger']);
  assert.equal(r.status, 1); assert.match(r.stderr, /Malformed/);
  assert.equal(await fs.readFile(file, 'utf8'), '{broken');
});

test('unsafe filenames, duplicate IDs and unsupported versions are refused', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Safe');
  const file = path.join(v.drafts, '_index.json');
  for (const value of [
    { version: 1, chapters: [{ ...c, filename: '../outside.md' }] },
    { version: 1, chapters: [c, { ...c, filename: 'other.md' }] },
    { version: 2, chapters: [c] },
  ]) {
    await fs.writeFile(file, JSON.stringify(value));
    assert.equal(run(v.root, ['chapter', 'list']).status, 1);
  }
});

test('vault and chapter symlinks cannot redirect writes', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Safe');
  const outside = path.join(v.root, 'outside.md');
  await fs.writeFile(outside, 'outside');
  await fs.unlink(chapterFile(v,c)); await fs.symlink(outside, chapterFile(v,c));
  assert.equal(run(v.root, ['chapter', 'rename', c.id, 'Bad']).status, 1);
  assert.equal(await fs.readFile(outside, 'utf8'), 'outside');
  const other = path.join(v.root, 'other'); await fs.mkdir(other);
  await fs.symlink(v.drafts, path.join(other, 'Drafts'));
  await assert.rejects(vaultAt(other), /real directory/);
});

test('CLI lock blocks another writer and does not remove its lock', async t => {
  const v = await fixture(t), lock = path.join(v.drafts, '.typer-cli.lock');
  await fs.writeFile(lock, 'another process');
  assert.equal(run(v.root, ['chapter', 'new', 'Blocked']).status, 1);
  assert.equal(await fs.readFile(lock, 'utf8'), 'another process');
  assert.equal((await loadIndex(v)).index.chapters.length, 0);
});

test('interrupted transaction can be recovered after the chapter write but before index', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Before'), snapshot = await loadIndex(v);
  const after = '# Before\n\nRecovered words\n';
  const index = structuredClone(snapshot.index); index.chapters[0].wordCount = 2;
  const journal = { version: 1, changes: [
    { name: c.filename, before: '# Before\n\n', after },
    { name: '_index.json', before: snapshot.raw, after: JSON.stringify(index) },
  ] };
  await fs.writeFile(chapterFile(v,c), after);
  await fs.writeFile(path.join(v.drafts, '.typer-cli-transaction.json'), JSON.stringify(journal));
  assert.equal(run(v.root, ['chapter', 'list']).status, 1);
  assert.deepEqual(await recover(v), { recovered: true });
  assert.equal((await loadIndex(v)).index.chapters[0].wordCount, 2);
  assert.deepEqual(await recover(v), { recovered: false });
});

test('recovery refuses external changes and preserves journal', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Before'), snapshot = await loadIndex(v);
  const journal = { version: 1, changes: [
    { name: c.filename, before: '# Before\n\n', after: 'pending' },
    { name: '_index.json', before: snapshot.raw, after: snapshot.raw },
  ] };
  await fs.writeFile(chapterFile(v,c), 'external');
  const file = path.join(v.drafts, '.typer-cli-transaction.json');
  await fs.writeFile(file, JSON.stringify(journal));
  await assert.rejects(recover(v), /Recovery conflict/);
  assert.equal(await fs.readFile(chapterFile(v,c), 'utf8'), 'external');
  assert.ok(await fs.stat(file));
});

test('browse and search skip symlinks, hidden directories and binary or large text', async t => {
  const v = await fixture(t);
  await fs.mkdir(path.join(v.root, 'research')); await fs.mkdir(path.join(v.root, '.git'));
  await fs.writeFile(path.join(v.root, 'research', 'note.md'), 'Winter\nA WINTER night.\n');
  await fs.writeFile(path.join(v.root, '.git', 'secret.txt'), 'Winter');
  await fs.symlink(v.root, path.join(v.root, 'loop'));
  await fs.writeFile(path.join(v.root, 'bad.txt'), Buffer.from([0xff, 0xfe]));
  await fs.writeFile(path.join(v.root, 'large.txt'), 'x'.repeat(2 * 1024 * 1024 + 1));
  const result = JSON.parse((await assertOK(run(v.root, ['search', 'winter', '--ignore-case', '--json']))).stdout);
  assert.deepEqual(result.matches.map(m=>m.line), [1, 2]); assert.equal(result.skipped.length, 2);
  assert.equal(run(v.root, ['vault', 'browse', '..']).status, 1);
  assert.equal(run(v.root, ['vault', 'browse', 'loop']).status, 1);
  const rows = JSON.parse(run(v.root, ['vault', 'browse', 'research', '--json']).stdout);
  assert.equal(rows[0].name, 'note.md');
});

test('export refuses overwrite, supports exact JSON and reports missing chapters', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Title');
  const output = path.join(v.root, 'book.md');
  await assertOK(run(v.root, ['export', '--output', output]));
  assert.equal(run(v.root, ['export', '--output', output]).status, 1);
  const result = JSON.parse(run(v.root, ['export', '--json']).stdout);
  assert.equal(result.markdown, await fs.readFile(output, 'utf8'));
  await fs.unlink(chapterFile(v,c));
  assert.equal(run(v.root, ['export']).status, 1);
});

test('dashboard counts live contents and has opt-in static art without escape codes', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Title');
  await fs.writeFile(chapterFile(v,c), '# Title\n\nOne two\n');
  const plain = run(v.root, ['dashboard', '--plain']).stdout;
  assert.match(plain, /2 words/); assert.doesNotMatch(plain, /\x1b|\( -\.- \)/);
  assert.match(run(v.root, ['dashboard', '--art']).stdout, /\( -\.- \)/);
  const result = JSON.parse(run(v.root, ['dashboard', '--json']).stdout);
  assert.equal(result.words, 2);
});

test('init is idempotent and will not hide unindexed Markdown', async t => {
  const v = await fixture(t); await createChapter(v, 'Kept');
  await initVault(v.root); assert.equal((await loadIndex(v)).index.chapters.length, 1);
  await fs.unlink(path.join(v.drafts, '_index.json'));
  await assert.rejects(initVault(v.root), /Unindexed Markdown/);
});

test('CLI rejects invalid commands/options before mutating', async t => {
  const v = await fixture(t);
  for (const args of [['chapter','new'], ['chapter','new','bad\ntitle'], ['chapter','new','Title','--output','x'],
    ['search',''], ['export','--format','pdf'], ['dashboard','--json','--art'], ['what'], ['--unknown']]) {
    assert.equal(run(v.root,args).status, 1, JSON.stringify(args));
  }
  assert.equal((await loadIndex(v)).index.chapters.length, 0);
});

test('ancestor vault discovery works from a nested folder', async t => {
  const v = await fixture(t); await createChapter(v,'Found');
  const nested = path.join(v.root,'research'); await fs.mkdir(nested);
  const result = spawnSync(process.execPath,[executable,'chapter','list','--json'], {
    cwd: nested, encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=='TYPER_VAULT')),
  });
  assert.equal(result.status,0,result.stderr); assert.equal(JSON.parse(result.stdout)[0].title,'Found');
});

test('header-only and CRLF edits keep title and body counts consistent', async t => {
  const v = await fixture(t), c = await createChapter(v, 'Before');
  let snapshot = await loadIndex(v);
  await saveEdited(v, c.id, snapshot.raw, '# Before\n\n', '# Header only');
  snapshot = await loadIndex(v);
  assert.equal(snapshot.index.chapters[0].wordCount, 0);
  await saveEdited(v, c.id, snapshot.raw, '# Header only', '# Title\r\n\r\nTwo words\r\n');
  assert.equal((await loadIndex(v)).index.chapters[0].wordCount, 2);
});

test('invalid recovery entries cannot escape Drafts or overwrite the lock', async t => {
  const v = await fixture(t);
  for (const name of ['../outside.md', '.typer-cli.lock']) {
    await fs.writeFile(path.join(v.drafts, '.typer-cli-transaction.json'), JSON.stringify({
      version: 1, changes: [{ name, before: null, after: 'bad' }],
    }));
    await assert.rejects(recover(v), /Invalid recovery entry/);
    await assert.rejects(fs.stat(path.join(v.root, 'outside.md')), { code: 'ENOENT' });
  }
});
