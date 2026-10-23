# Typer CLI

A Linux command-line writing workspace for Triptych. It uses the desktop vault's
Markdown chapters and version-1 JSON index, with a static dashboard and optional
ASCII companion. There are no animations, Tauri libraries, webviews, or runtime
npm dependencies. Node.js 22.12 or newer is required; tested with Node 24.

## Run

From the repository, without installing frontend dependencies:

```sh
node cli/bin/typer.mjs --help
node cli/bin/typer.mjs vault init ~/Writing
node cli/bin/typer.mjs --vault ~/Writing chapter new "A quiet beginning"
node cli/bin/typer.mjs --vault ~/Writing chapter list
```

For a `typer` executable, install the local package into a user-owned prefix:

```sh
npm install --global ./cli --prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
typer --help
```

No global install is needed for development. Replace `typer` below with
`node /absolute/path/to/Typer/cli/bin/typer.mjs` if preferred.

## Everyday workflow

```sh
export TYPER_VAULT="$HOME/Writing"
typer vault browse
typer vault browse research
typer chapter new "Winter letters"
typer chapter list --json
typer edit CHAPTER_ID --editor "nano"
typer chapter rename CHAPTER_ID "The first letter"
typer chapter move CHAPTER_ID 1
typer search "winter" --ignore-case
typer export --output /tmp/manuscript.md
typer dashboard --art
```

Use the actual stable ID from `chapter list` in place of `CHAPTER_ID`.
`--vault PATH` takes precedence over `TYPER_VAULT`. With neither set, the CLI
finds the nearest ancestor containing `Drafts/_index.json`, falling back to the
current directory. `vault init PATH` initializes a new vault and leaves existing
indexes intact. It refuses to initialize over unindexed Markdown files; restore
the existing index instead.

Supported commands:

| Command | Behavior |
| --- | --- |
| `vault browse [PATH]` | One directory at a time, relative to the vault |
| `chapter list` | Manuscript order, IDs, titles, live word counts |
| `chapter new TITLE` | New chapter with a unique immutable filename |
| `chapter show ID` | Complete Markdown source |
| `chapter rename ID TITLE` | Update title/header without changing ID or filename |
| `chapter move ID POSITION` | Reorder at a 1-based position |
| `edit ID` | External editor with conflict detection |
| `search TEXT` | Literal, line-based Markdown/text search, recursively |
| `export` | Ordered Markdown manuscript with horizontal-rule separators |
| `dashboard` | Static chapter tree and word totals; the default command |
| `vault recover` | Complete an interrupted CLI write after checking conflicts |

The first release has no chapter deletion command. Notes under `Drafts/_notes`
are preserved. Editing can change their text anchors, as it does in the desktop
editor; the CLI does not resolve annotations.

## Editors and output

Editor precedence is `--editor`, `$VISUAL`, then `$EDITOR`. There is no guessed
editor. Quoted executable paths and arguments are supported, for example
`--editor 'code --wait'`. The editor must wait until editing is finished. Commands
are launched directly, with no shell expansion, pipelines, or command substitution.

The editor opens a private temporary copy. On successful exit, the CLI checks
the original chapter and index, then saves the edited text and new word count.
A leading H1 updates the title. If the H1 is removed, the existing title is
restored above the edited body. If the editor fails or a conflict occurs, the
original is not overwritten by that edit and the temporary file path is printed
to stderr. Preserve or manually copy that file as appropriate. Word counts match
the desktop's whitespace-token rule; they are not language-aware CJK counts.

`--json` returns structured output for all noninteractive commands. `--plain`
removes decorative dashboard borders, and borders are suppressed when output is
piped. The companion appears only with `dashboard --art`. No animation or ANSI
color is used. Human-readable labels strip terminal control sequences; Markdown
is exported unchanged to files or pipes. Errors go to stderr with exit status 1;
successful operations (including no search matches) exit 0. `--` ends options.

Search includes `.md`, `.markdown`, and `.txt` files. Hidden directories,
`node_modules`, and `_notes` are skipped; symlinks are never followed. Files over
2 MiB or invalid UTF-8 are skipped and reported. PDF/EPUB/DOCX conversion is not
part of this release. Export supports Markdown only. `--output PATH` refuses to
overwrite existing files, including symlinks. Shell redirection follows normal
shell rules, so `> existing-file` can still truncate a file before Typer starts.

## Persistence and recovery

Close the desktop app before CLI writes. The CLI's exclusive lock serializes
CLI writers, but the desktop currently has no shared filesystem locking. Conflict
checks catch changes made during editing; they cannot prevent an uncooperative
desktop process from writing between a check and a save. Concurrent desktop/CLI
editing is not supported. Use local, trusted vaults; this is not a security
boundary against another process modifying the same directory.

The CLI validates index versions, required metadata, unique IDs/filenames, and
chapter paths. It refuses malformed indexes and symlinked chapter files instead
of treating corrupt data as empty. Renames and reorders preserve unknown index
and chapter fields. Each write uses a temporary file, fsync, and atomic rename.
Multi-file updates first record before/after contents in
`Drafts/.typer-cli-transaction.json`, with the index written last. Interrupted
transactions block normal chapter operations until recovery; these updates are
recoverable, not a filesystem-wide atomic transaction.

If an operation was interrupted:

1. Close the desktop app and confirm no Typer CLI writer is still running.
2. If a stale `Drafts/.typer-cli.lock` remains, inspect its PID/start time and
   remove it **only after confirming its writer has stopped**. Locks are never
   silently stolen.
3. Run `typer --vault PATH vault recover`. It finishes the recorded writes only
   if every affected file still matches its recorded before or after contents.
4. If recovery reports a conflict, preserve the journal and affected files for
   manual reconciliation. Do not delete the journal to suppress the error.

The journal contains chapter text and should be treated as private vault data.
Atomic replacements preserve existing file mode bits but do not preserve custom
ACLs or extended attributes. Hard-linked files are replaced, not edited in place.

## Habits, shop, and redeem: next increment

These fit the CLI naturally:

```text
typer habit log <activity> --minutes 30
typer habit status
typer shop list
typer shop buy <reward-id>
typer inventory
typer redeem <reward-id>
```

These are proposed commands, not implemented commands. The desktop currently
stores tokens, task logs, and inventory in separate app-data files, outside the
vault. Buying deducts tokens before saving inventory, so failure can leave a
partial transaction. Before enabling CLI earn/buy/redeem operations, introduce a
shared transaction/locking layer used by both clients, preserve reward IDs and
pricing rules, and explicitly locate or migrate the app-data directory. Logging
an activity must also avoid double-crediting retries. The CLI first release does
not alter token balances, inventory, rewards, or the desktop app's storage.

## Validation

```sh
npm --prefix cli test
npm run build
```

The CLI tests use temporary vaults and fake editors; no real writing data is
touched. They cover the end-to-end workflow, desktop schema compatibility,
preserved notes, editor failures/conflicts, malformed data, path/symlink checks,
CLI locking, transaction recovery, search exclusions, export overwrite protection,
and plain/JSON dashboard output. Linux CLI tests do not require native Tauri
dependencies. Actual interactive terminal/editor testing remains a release check.
