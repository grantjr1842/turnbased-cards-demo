# Agent-Browser Double-Chrome Workflow

Use this workflow when headed `agent-browser` appears to launch two Chrome windows instead of one.

## What It Collects

- `AGENT_BROWSER_*` environment variables
- `agent-browser` version and doctor output
- project and user browser config files
- Chrome and `agent-browser` process snapshots before and after launch
- those process snapshots are filtered to the `agent-browser` Chrome tree so unrelated browser processes do not muddy the diagnosis
- per-phase process summaries that count matching lines, Chrome browser-root processes, and the root PIDs
- session, tab, and CDP URL state from `agent-browser`
- raw `--debug` / `--verbose` launch logs

## How To Run

```bash
./scripts/diagnose-agent-browser-double-chrome.sh
./scripts/diagnose-agent-browser-double-chrome.sh http://127.0.0.1:5173
```

The first command isolates browser startup with a blank `open` call.
The second command repeats the same capture against the real app URL so you can compare behavior.
If the target URL is not live yet, the script writes a clear preflight message instead of timing out on navigation.

## How To Read It

- If the blank launch already shows two Chrome process trees, the duplication is in `agent-browser` config, launch flags, or local browser state.
- If the blank launch is clean but the app launch duplicates Chrome, the app URL, redirects, or the existing client/server startup path is involved.
- If `session list` shows one session but the process list shows two browser trees, the issue is launch-level duplication rather than multiple `agent-browser` sessions.
- Start with the `*-summary.txt` files to see whether the phase actually produced more than one actual Chrome browser executable before reading the raw process dump. The summary count excludes crashpad, zygote, renderer, and other helper processes, and the PID line tells you exactly which browser roots were present.
- If `tab list` shows one browser with two tabs, you do not have two Chrome instances. You have one browser window with multiple tabs.
- If you are comparing against `scripts/smoke-web-agent-browser.sh`, remember that it intentionally does a desktop run and then a mobile run as separate `open_clean` phases. Two launch phases in that script are expected; only overlapping browser roots would indicate a real duplication bug.

## Follow-Up Checks

- Re-run with a clean environment by unsetting `AGENT_BROWSER_AUTO_CONNECT`, `AGENT_BROWSER_PROFILE`, and `AGENT_BROWSER_HEADED` to isolate config precedence.
- Compare the `*-open.log` files between the blank and target runs.
- If the duplicate window appears only in headed mode, compare against a headless run to confirm the extra window is tied to Chrome launch policy instead of page behavior.

The script writes every capture under `.tmp-agent-browser/diagnostics/<timestamp>/` so you can diff multiple runs without overwriting prior evidence.
