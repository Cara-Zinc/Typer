import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadIndex, findChapter, chapterText, saveEdited } from './vault.mjs';

// Support quoted executable paths and arguments, without shell evaluation.
export function splitEditor(command) {
  const words = [];
  let word = '', quote = '', escaped = false, active = false;
  for (const char of command) {
    if (escaped) { word += char; escaped = false; active = true; }
    else if (char === '\\' && quote !== "'") { escaped = true; active = true; }
    else if (quote) { if (char === quote) quote = ''; else word += char; }
    else if (char === '"' || char === "'") { quote = char; active = true; }
    else if (/\s/.test(char)) { if (active) { words.push(word); word = ''; active = false; } }
    else { word += char; active = true; }
  }
  if (quote || escaped) throw new Error('Unclosed quote or escape in editor command.');
  if (active) words.push(word);
  if (!words[0]) throw new Error('Set VISUAL or EDITOR, or pass --editor "nano".');
  return words;
}

export async function editChapter(vault, id, command) {
  const args = splitEditor(command);
  const { raw, index } = await loadIndex(vault), chapter = findChapter(index, id);
  const before = await chapterText(vault, chapter);
  const directory = await mkdtemp(path.join(tmpdir(), 'typer-edit-'));
  const file = path.join(directory, chapter.filename);
  await writeFile(file, before, { mode: 0o600 });
  try {
    const result = spawnSync(args[0], [...args.slice(1), file], { stdio: 'inherit', shell: false });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Editor exited ${result.signal ?? result.status}; vault was not saved.`);
    const text = await readFile(file, 'utf8');
    const updated = text === before ? chapter : await saveEdited(vault, id, raw, before, text);
    await rm(directory, { recursive: true });
    return updated;
  } catch (error) {
    throw new Error(`${error.message}\nEdited copy retained at: ${file}`);
  }
}
