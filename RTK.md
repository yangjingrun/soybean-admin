# RTK - Rust Token Killer (Codex CLI)

**Usage**: Token-optimized CLI proxy for shell commands in Codex.

## Codex Rule

Codex does not auto-hook shell commands. The agent must explicitly run shell commands through `rtk`.

- Use `rtk <command>` for noisy, low-risk output.
- Use `rtk proxy <command>` when exact output matters but the command should still be tracked by RTK.
- Only use raw commands for shell syntax/builtins that RTK cannot wrap cleanly, and mention why if it matters.

Examples:

```bash
rtk git status
rtk ls
rtk grep "pattern" src
rtk pnpm typecheck
rtk proxy git diff
rtk proxy sed -n '1,220p' file.ts
```

## Detail Safety

- If a command result directly drives a code edit, inspect the exact file or diff with `rtk proxy`.
- If a test, lint, typecheck, or build command fails under RTK, rerun the focused command with `rtk proxy`.
- If RTK output says content was truncated, capped, summarized, or points to a full-output file, inspect the full output before deciding.
- Do not use `rtk` for shell builtins or shell syntax such as `test -d`, `cd`, `export`, redirects, pipes, or command substitution. Use raw shell syntax, or wrap the whole command with `rtk proxy` only when useful.

## Meta Commands

```bash
rtk gain            # Token savings analytics
rtk gain --history  # Recent command savings history
rtk proxy <cmd>     # Run raw command without filtering
```

## Verification

```bash
rtk --version
rtk gain
which rtk
```
