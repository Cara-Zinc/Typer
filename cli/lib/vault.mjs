import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const INDEX = '_index.json';
const JOURNAL = '.typer-cli-transaction.json';
const LOCK = '.typer-cli.lock';
const json = value => JSON.stringify(value, null, 2) + '\n';
export const bodyOf = text => text.replace(/^#[ \t]+[^\r\n]*(?:\r?\n|$)(?:\r?\n)?/, '');
export const countWords = text => bodyOf(text).match(/\S+/gu)?.length ?? 0;
export const titleOf = (text, fallback) => text.match(/^#\s+([^\r\n]+)/)?.[1].trim() || fallback;

async function stat(file) {
  try { return await fs.lstat(file); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function vaultAt(input) {
  const root = await fs.realpath(path.resolve(input));
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Vault must be a directory.');
  const drafts = path.join(root, 'Drafts');
  const entry = await stat(drafts);
  if (entry && (!entry.isDirectory() || entry.isSymbolicLink())) {
    throw new Error('Drafts must be a real directory, not a symlink.');
  }
  return { root, drafts };
}

export async function discoverVault(cwd) {
  let current = path.resolve(cwd);
  while (true) {
    if (await stat(path.join(current, 'Drafts', INDEX))) return current;
    const parent = path.dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

function validFilename(name) {
  return typeof name === 'string' && /^[^/\\\x00-\x1f]+\.md$/.test(name)
    && !name.startsWith('.') && !name.startsWith('_');
}

async function safeFile(vault, name, internal = false) {
  if (!(validFilename(name) || (internal && [INDEX, JOURNAL, LOCK].includes(name)))) {
    throw new Error(`Unsafe vault filename: ${name}`);
  }
  const file = path.join(vault.drafts, name);
  const entry = await stat(file);
  if (entry && (!entry.isFile() || entry.isSymbolicLink())) {
    throw new Error(`Refusing non-regular file: ${name}`);
  }
  return file;
}

async function readOptional(vault, name) {
  const file = await safeFile(vault, name, true);
  try { return await fs.readFile(file, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function validateIndex(index) {
  if (!index || index.version !== 1 || !Array.isArray(index.chapters)) {
    throw new Error('Unsupported or malformed Drafts/_index.json; no files changed.');
  }
  const ids = new Set(), files = new Set();
  for (const c of index.chapters) {
    if (!c || typeof c.id !== 'string' || !c.id || ids.has(c.id)
        || !validFilename(c.filename) || files.has(c.filename)
        || typeof c.title !== 'string' || !c.title.trim() || /[\r\n]/.test(c.title)
        || !Number.isSafeInteger(c.wordCount) || c.wordCount < 0
        || typeof c.createdAt !== 'string' || typeof c.updatedAt !== 'string') {
      throw new Error('Invalid or duplicate chapter metadata; no files changed.');
    }
    ids.add(c.id); files.add(c.filename);
  }
  return index;
}

export async function loadIndex(vault) {
  if (await readOptional(vault, JOURNAL) !== null) {
    throw new Error('Interrupted CLI write found. Close the desktop app and run: typer vault recover');
  }
  const raw = await readOptional(vault, INDEX);
  if (raw === null) throw new Error('No chapter index. Run typer vault init PATH for a new vault.');
  let index;
  try { index = JSON.parse(raw); } catch { throw new Error('Malformed Drafts/_index.json; no files changed.'); }
  return { raw, index: validateIndex(index) };
}

async function atomicWrite(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    const previous = await stat(file);
    handle = await fs.open(temporary, 'wx', previous ? previous.mode & 0o777 : 0o600);
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    await fs.rename(temporary, file);
    const directory = await fs.open(path.dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    if (handle) await handle.close();
    await fs.rm(temporary, { force: true });
  }
}

async function locked(vault, action) {
  await fs.mkdir(vault.drafts, { recursive: true });
  const file = await safeFile(vault, LOCK, true);
  let handle;
  try { handle = await fs.open(file, 'wx', 0o600); } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Vault is locked by another CLI operation. See cli/README.md for stale-lock recovery.');
    throw error;
  }
  try {
    await handle.writeFile(json({ pid: process.pid, startedAt: new Date().toISOString() }));
    return await action();
  } finally {
    await handle.close();
    await fs.unlink(file);
  }
}

// A journal allows interrupted multi-file writes to be completed explicitly.
// It is NOT a cross-process lock for the desktop application, which must be closed.
async function commit(vault, changes) {
  for (const change of changes) {
    if (await readOptional(vault, change.name) !== change.before) {
      throw new Error(`Concurrent change detected in ${change.name}; nothing overwritten.`);
    }
  }
  await atomicWrite(await safeFile(vault, JOURNAL, true), json({ version: 1, changes }));
  for (const change of changes) await atomicWrite(await safeFile(vault, change.name, true), change.after);
  await fs.unlink(path.join(vault.drafts, JOURNAL));
}

export async function initVault(input) {
  await fs.mkdir(path.resolve(input), { recursive: true });
  const vault = await vaultAt(input);
  return locked(vault, async () => {
    if (await readOptional(vault, JOURNAL) !== null) throw new Error('Pending transaction; run vault recover.');
    if (await readOptional(vault, INDEX) !== null) { await loadIndex(vault); return vault; }
    if ((await fs.readdir(vault.drafts)).some(name => name.endsWith('.md'))) {
      throw new Error('Unindexed Markdown chapters found. Restore the index before initializing; existing files were not changed.');
    }
    await atomicWrite(path.join(vault.drafts, INDEX), json({ version: 1, chapters: [] }));
    return vault;
  });
}

export async function recover(vault) {
  return locked(vault, async () => {
    const raw = await readOptional(vault, JOURNAL);
    if (raw === null) return { recovered: false };
    const journal = JSON.parse(raw);
    if (journal.version !== 1 || !Array.isArray(journal.changes) || !journal.changes.length) {
      throw new Error('Invalid recovery journal. Preserve it for manual recovery.');
    }
    const seen = new Set();
    for (const c of journal.changes) {
      if ((!validFilename(c.name) && c.name !== INDEX) || seen.has(c.name)
          || !(c.before === null || typeof c.before === 'string') || typeof c.after !== 'string') {
        throw new Error('Invalid recovery entry; no files changed.');
      }
      seen.add(c.name);
      if (c.name === INDEX) validateIndex(JSON.parse(c.after));
      const current = await readOptional(vault, c.name);
      if (current !== c.before && current !== c.after) throw new Error(`Recovery conflict in ${c.name}; preserve the journal and resolve manually.`);
    }
    if (!seen.has(INDEX)) throw new Error('Recovery journal is missing its index.');
    for (const c of journal.changes) await atomicWrite(await safeFile(vault, c.name, true), c.after);
    await fs.unlink(path.join(vault.drafts, JOURNAL));
    return { recovered: true };
  });
}

function cleanTitle(title) {
  title = title?.trim();
  if (!title || /[\x00-\x1f\x7f]/.test(title)) throw new Error('Supply a nonempty, single-line chapter title.');
  return title;
}

export function findChapter(index, id) {
  const chapter = index.chapters.find(c => c.id === id);
  if (!chapter) throw new Error(`Unknown chapter ID: ${id}. Run chapter list.`);
  return chapter;
}

export async function chapterText(vault, chapter) {
  const text = await readOptional(vault, chapter.filename);
  if (text === null) throw new Error(`Missing chapter file: ${chapter.filename}`);
  return text;
}

export async function listChapters(vault) {
  const { index } = await loadIndex(vault);
  return Promise.all(index.chapters.map(async c => ({ ...c, wordCount: countWords(await chapterText(vault, c)) })));
}

export async function createChapter(vault, title) {
  title = cleanTitle(title);
  return locked(vault, async () => {
    const { index, raw } = await loadIndex(vault);
    const now = new Date().toISOString(), id = `ch_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'untitled';
    const chapter = { id, title, filename: `${now.replace(/[-:]/g, '').slice(0, 15).replace('T', '-')}-${slug}-${id}.md`, wordCount: 0, createdAt: now, updatedAt: now };
    index.chapters.push(chapter);
    await commit(vault, [{ name: chapter.filename, before: null, after: `# ${title}\n\n` }, { name: INDEX, before: raw, after: json(index) }]);
    return chapter;
  });
}

export async function renameChapter(vault, id, title) {
  title = cleanTitle(title);
  return locked(vault, async () => {
    const { index, raw } = await loadIndex(vault), chapter = findChapter(index, id);
    const before = await chapterText(vault, chapter);
    chapter.title = title; chapter.updatedAt = new Date().toISOString();
    chapter.wordCount = countWords(before);
    await commit(vault, [{ name: chapter.filename, before, after: `# ${title}\n\n${bodyOf(before)}` }, { name: INDEX, before: raw, after: json(index) }]);
    return chapter;
  });
}

export async function moveChapter(vault, id, position) {
  return locked(vault, async () => {
    const { index, raw } = await loadIndex(vault), chapter = findChapter(index, id);
    if (!Number.isInteger(position) || position < 1 || position > index.chapters.length) throw new Error('Position must be between 1 and the chapter count.');
    index.chapters.splice(index.chapters.indexOf(chapter), 1);
    index.chapters.splice(position - 1, 0, chapter);
    await commit(vault, [{ name: INDEX, before: raw, after: json(index) }]);
    return chapter;
  });
}

export async function saveEdited(vault, id, snapshot, before, text) {
  return locked(vault, async () => {
    const { index, raw } = await loadIndex(vault);
    if (raw !== snapshot) throw new Error('Chapter metadata changed while editing; your edited copy has been retained.');
    const chapter = findChapter(index, id);
    chapter.title = cleanTitle(titleOf(text, chapter.title));
    if (!/^#[ \t]+[^\r\n]+(?:\r?\n|$)/.test(text)) text = `# ${chapter.title}\n\n${text}`;
    chapter.wordCount = countWords(text); chapter.updatedAt = new Date().toISOString();
    await commit(vault, [{ name: chapter.filename, before, after: text }, { name: INDEX, before: raw, after: json(index) }]);
    return chapter;
  });
}

export async function exportMarkdown(vault) {
  const { index } = await loadIndex(vault);
  return (await Promise.all(index.chapters.map(c => chapterText(vault, c)))).map(s => s.trimEnd()).join('\n\n---\n\n') + (index.chapters.length ? '\n' : '');
}

const ignored = new Set(['.git', '.triptych', 'node_modules', '_notes']);
export async function browse(vault, relative = '.') {
  const target = path.resolve(vault.root, relative);
  const rel = path.relative(vault.root, target);
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) throw new Error('Browse path must stay inside the vault.');
  let walk = vault.root;
  for (const part of rel.split(path.sep).filter(Boolean)) {
    walk = path.join(walk, part);
    if ((await fs.lstat(walk)).isSymbolicLink()) throw new Error('Browsing symlink paths is not supported.');
  }
  return (await fs.readdir(target, { withFileTypes: true }))
    .filter(e => !e.name.startsWith('.') && !ignored.has(e.name))
    .map(e => ({ name: e.name, path: path.relative(vault.root, path.join(target, e.name)), kind: e.isSymbolicLink() ? 'link' : e.isDirectory() ? 'directory' : 'file' }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

export async function search(vault, query, ignoreCase = false) {
  if (!query) throw new Error('Search text must not be empty.');
  const results = [], skipped = [];
  const needle = ignoreCase ? query.toLowerCase() : query;
  async function walk(dir) {
    for (const entry of await browse(vault, dir)) {
      if (entry.kind === 'directory') await walk(entry.path);
      else if (entry.kind === 'file' && /\.(md|markdown|txt)$/i.test(entry.name)) {
        const file = path.join(vault.root, entry.path);
        if ((await fs.stat(file)).size > 2 * 1024 * 1024) { skipped.push(entry.path); continue; }
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(await fs.readFile(file)); }
        catch (error) { if (error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA') { skipped.push(entry.path); continue; } throw error; }
        text.split(/\r?\n/).forEach((line, i) => {
          if ((ignoreCase ? line.toLowerCase() : line).includes(needle)) results.push({ path: entry.path, line: i + 1, text: line });
        });
      }
    }
  }
  await walk('.');
  return { matches: results, skipped };
}
