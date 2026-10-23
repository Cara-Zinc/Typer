#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { vaultAt, discoverVault, initVault, recover, loadIndex, findChapter,
  listChapters, chapterText, createChapter, renameChapter, moveChapter,
  exportMarkdown, browse, search } from '../lib/vault.mjs';
import { editChapter } from '../lib/editor.mjs';

const HELP = `Typer CLI — a quiet local writing workspace

Usage: typer [--vault PATH] COMMAND [--json | --plain]

  dashboard                         Static chapter and word-count overview (default)
  vault init PATH                   Initialize a new vault without replacing files
  vault browse [PATH]               List a vault directory (no symlink traversal)
  vault recover                     Complete an interrupted CLI transaction
  chapter list                      List stable chapter IDs in manuscript order
  chapter new "TITLE"                Create a Markdown chapter
  chapter show ID                    Print chapter Markdown
  chapter rename ID "TITLE"          Change title; keep ID, filename, and notes
  chapter move ID POSITION           Move to a 1-based manuscript position
  edit ID [--editor "COMMAND"]        Open a temporary copy in VISUAL or EDITOR
  search "TEXT" [--ignore-case]       Literal search in Markdown and text files
  export [--format markdown]         Print manuscript in chapter order
         [--output PATH]             Create a new export file; never overwrite

Options:
  --vault PATH   Vault directory; otherwise find an ancestor vault or use cwd
  --json         Machine-readable output (not available for interactive edit)
  --plain        Plain text without decorative dashboard lines
  --art          Show a small static companion on the dashboard
  --help, -h     Show help
  --version      Show version

Requires Node.js 22.12+. No Tauri, browser, or npm install required.
Close the desktop app before CLI writes; the desktop does not honor CLI locks.
Habit/shop/redeem transactions are planned; this version does not change balances.
`;

// Never let text from the vault inject terminal escape/control sequences.
const safe = value => String(value).replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
const oneLine = value => safe(value).replace(/[\r\n\t]/g, ' ');
function print(value, opts, render) {
  if (opts.json) console.log(JSON.stringify(value, null, 2));
  else console.log(render(value));
}
function expect(args, min, max = min) {
  if (args.length < min || args.length > max) throw new Error('Wrong number of arguments. See typer --help; quote titles and search text.');
}

async function main() {
  const { values: opts, positionals } = parseArgs({ allowPositionals: true, options: {
    vault: { type: 'string' }, json: { type: 'boolean' }, plain: { type: 'boolean' },
    art: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' },
    editor: { type: 'string' }, output: { type: 'string' }, format: { type: 'string' },
    'ignore-case': { type: 'boolean' },
  } });
  if (opts.help) { console.log(HELP); return; }
  if (opts.version) { console.log('0.1.0'); return; }
  if (opts.json && (opts.plain || opts.art)) throw new Error('--json cannot be combined with --plain or --art.');
  const [command = 'dashboard', ...args] = positionals;
  if (opts.editor !== undefined && command !== 'edit') throw new Error('--editor is only valid with edit.');
  if ((opts.output !== undefined || opts.format !== undefined) && command !== 'export') throw new Error('--output and --format are only valid with export.');
  if (opts['ignore-case'] && command !== 'search') throw new Error('--ignore-case is only valid with search.');
  if (opts.art && command !== 'dashboard') throw new Error('--art is only valid with dashboard.');
  if (command === 'vault' && args[0] === 'init') {
    expect(args, 2);
    if (opts.vault) throw new Error('Use the PATH argument for vault init, not --vault.');
    const vault = await initVault(args[1]);
    print({ vault: vault.root }, opts, v => `Vault ready: ${oneLine(v.vault)}`);
    return;
  }
  if (!['dashboard', 'vault', 'chapter', 'edit', 'search', 'export'].includes(command)) throw new Error(`Unknown command: ${command}. See typer --help.`);
  const vault = await vaultAt(opts.vault ?? process.env.TYPER_VAULT ?? await discoverVault(process.cwd()));
  if (command === 'vault') {
    const [action, ...rest] = args;
    if (action === 'browse') {
      expect(rest, 0, 1);
      print(await browse(vault, rest[0]), opts, rows => rows.map(r => `${r.kind === 'directory' ? '[dir] ' : r.kind === 'link' ? '[link]' : '      '} ${oneLine(r.name)}`).join('\n') || '(empty)');
    } else if (action === 'recover') {
      expect(rest, 0);
      print(await recover(vault), opts, r => r.recovered ? 'Interrupted write recovered.' : 'No interrupted write.');
    } else throw new Error('Expected vault init, browse, or recover.');
  } else if (command === 'chapter') {
    const [action, ...rest] = args;
    if (action === 'list') {
      expect(rest, 0);
      print(await listChapters(vault), opts, rows => rows.map((c, i) => `${i + 1}. ${oneLine(c.id)}  ${oneLine(c.title)}  (${c.wordCount} words)`).join('\n') || 'No chapters. Use chapter new "Title".');
    } else if (action === 'show') {
      expect(rest, 1);
      const { index } = await loadIndex(vault), c = findChapter(index, rest[0]);
      const text = await chapterText(vault, c);
      if (opts.json) console.log(JSON.stringify({ ...c, markdown: text }, null, 2));
      else process.stdout.write(process.stdout.isTTY ? safe(text) : text);
    } else {
      let chapter;
      if (action === 'new') { expect(rest, 1); chapter = await createChapter(vault, rest[0]); }
      else if (action === 'rename') { expect(rest, 2); chapter = await renameChapter(vault, ...rest); }
      else if (action === 'move') { expect(rest, 2); chapter = await moveChapter(vault, rest[0], Number(rest[1])); }
      else throw new Error('Expected chapter list, new, show, rename, or move.');
      print(chapter, opts, c => `${oneLine(c.id)}  ${oneLine(c.title)}`);
    }
  } else if (command === 'edit') {
    expect(args, 1);
    if (opts.json) throw new Error('edit is interactive; --json is not supported.');
    const chapter = await editChapter(vault, args[0], opts.editor ?? process.env.VISUAL ?? process.env.EDITOR ?? '');
    console.log(`Saved: ${oneLine(chapter.title)} (${chapter.wordCount} words)`);
  } else if (command === 'search') {
    expect(args, 1);
    const result = await search(vault, args[0], opts['ignore-case']);
    print(result, opts, r => r.matches.map(m => `${oneLine(m.path)}:${m.line}: ${oneLine(m.text)}`).join('\n') || 'No matches.');
    if (!opts.json && result.skipped.length) console.error(`Skipped ${result.skipped.length} files larger than 2 MiB or not valid UTF-8.`);
  } else if (command === 'export') {
    expect(args, 0);
    if (opts.format && opts.format !== 'markdown') throw new Error('Only --format markdown is supported.');
    const markdown = await exportMarkdown(vault);
    if (opts.output) {
      await writeFile(opts.output, markdown, { flag: 'wx', mode: 0o600 });
      print({ output: opts.output }, opts, r => `Exported: ${oneLine(r.output)}`);
    } else if (opts.json) console.log(JSON.stringify({ markdown }, null, 2));
    else process.stdout.write(process.stdout.isTTY ? safe(markdown) : markdown);
  } else {
    expect(args, 0);
    const chapters = await listChapters(vault);
    const data = { vault: vault.root, chapters, words: chapters.reduce((n, c) => n + c.wordCount, 0) };
    print(data, opts, d => {
      const decorative = !opts.plain && (process.stdout.isTTY || opts.art);
      const width = Math.max(20, Math.min(process.stdout.columns || 64, 80));
      const lines = [`T Y P E R  |  ${oneLine(d.vault)}`];
      if (decorative) lines.push('-'.repeat(width));
      for (const [i, c] of d.chapters.entries()) lines.push(`${i + 1 === d.chapters.length ? "'--" : '|--'} ${oneLine(c.title)}  [${c.wordCount} words]`);
      if (!d.chapters.length) lines.push('No chapters yet. Try: typer chapter new "Beginning"');
      lines.push(`${d.chapters.length} chapters | ${d.words} words`);
      if (opts.art) lines.push('', '  /\u005c_/\u005c', ' ( -.- )   A little more written.');
      if (decorative) lines.push('-'.repeat(width));
      return lines.join('\n');
    });
  }
}

process.stdout.on('error', error => {
  if (error.code === 'EPIPE') process.exit(0);
  console.error(`typer: ${oneLine(error.message)}`); process.exit(1);
});
main().catch(error => {
  console.error(`typer: ${safe(error.message)}`);
  process.exitCode = 1;
});
