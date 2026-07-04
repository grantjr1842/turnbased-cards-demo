import assert from "node:assert/strict";
import { spawn, execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  allocateDebugPort,
  checkClean,
  cleanupChrome,
  click,
  connectCdp,
  evalScript,
  fill,
  navigate,
  resolveChromeBinary,
  screenshot,
  setViewport,
  startChrome,
  wait,
  waitFor,
  waitForChrome,
} from "../../scripts/browser-cdp-helper.mjs";

const ROOT_DIR = resolve(new URL("../..", import.meta.url).pathname);
const SERVER_DIR = resolve(ROOT_DIR, "server");
const CLIENT_DIR = resolve(ROOT_DIR, "web-react");
const SHOT_DIR = process.env.SHOT_DIR || ".tmp-cdp-smoke/e2e";
const APP_HOST = process.env.APP_HOST || "127.0.0.1";
let APP_PORT = process.env.APP_PORT || "5173";
let appUrl = process.env.APP_URL || `http://${APP_HOST}:${APP_PORT}`;
const API_URL = process.env.API_URL || "http://127.0.0.1:2567";
const DEBUG_PORT = allocateDebugPort();
const CHROME_BIN = resolveChromeBinary();

mkdirSync(SHOT_DIR, { recursive: true });

const processes: ReturnType<typeof spawn>[] = [];

function startProcess(command: string, args: string[], options: Parameters<typeof spawn>[2] = {}) {
  const proc = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  processes.push(proc);
  proc.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  proc.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  return proc;
}

function cleanup() {
  for (const proc of processes) {
    if (!proc.killed) proc.kill("SIGTERM");
  }
}

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

async function startStack() {
  const serverReady = await fetch(`${API_URL}/healthz`).then((res) => res.ok).catch(() => false);
  if (!serverReady) {
    startProcess("npm", ["run", "dev"], { cwd: SERVER_DIR });
    await wait(1500);
  }

  const clientReady = await fetch(appUrl).then((res) => res.ok).catch(() => false);
  if (!clientReady) {
    if (!process.env.APP_URL && appUrl === `http://${APP_HOST}:5173`) {
      APP_PORT = execSync(
        `node -e "const s=require('node:net').createServer();s.listen(0,'${APP_HOST}',()=>{console.log(s.address().port);s.close();});"`,
        { encoding: "utf8", shell: "/bin/bash" },
      ).trim();
      appUrl = `http://${APP_HOST}:${APP_PORT}`;
    }
    startProcess("npm", ["run", "dev", "--", "--host", APP_HOST, "--port", APP_PORT, "--strictPort"], {
      cwd: CLIENT_DIR,
    });
  }

  for (let i = 0; i < 40; i += 1) {
    const ok =
      (await fetch(`${API_URL}/healthz`).then((res) => res.ok).catch(() => false)) &&
      (await fetch(appUrl).then((res) => res.ok).catch(() => false));
    if (ok) return;
    await wait(1000);
  }
  throw new Error("Server or client did not become ready");
}

async function joinGame(cdp: Awaited<ReturnType<typeof connectCdp>>, name: string) {
  await fill(cdp, 'input[placeholder="Enter your player name"]', name);
  await click(cdp, ".primary-btn");
  await waitFor(cdp, 'document.querySelector(".game-shell") !== null', 30000);
}

async function openChrome() {
  const browser = startChrome({
    chromeBin: CHROME_BIN,
    debugPort: DEBUG_PORT,
    userDataDirPrefix: "/tmp/uno-cdp-e2e",
  });
  await waitForChrome(DEBUG_PORT);
  return browser;
}

async function playOneTurn(cdp: Awaited<ReturnType<typeof connectCdp>>) {
  const hasWinner = await evalScript(cdp, 'document.querySelector(".winner-podium-overlay") !== null');
  if (hasWinner.result.value) return "game-over" as const;

  const hasPlayable = await evalScript(
    cdp,
    'document.querySelector(".hand-card-wrapper.playable") !== null || document.querySelector(".draw-pile.guidance-pulse") !== null',
  );
  if (!hasPlayable.result.value) return "waiting" as const;

  const played = await evalScript(cdp, `(() => {
    const wildCard = document.querySelector('.hand-card-wrapper.playable button[aria-label$="Wild"]');
    if (wildCard) { wildCard.click(); return "wild"; }
    const wildDraw4 = document.querySelector('.hand-card-wrapper.playable button[aria-label$="Wild +4"]');
    if (wildDraw4) { wildDraw4.click(); return "wild"; }
    const reverseCard = document.querySelector('.hand-card-wrapper.playable button[aria-label$="Reverse"]');
    if (reverseCard) { reverseCard.click(); return "reverse"; }
    const skipCard = document.querySelector('.hand-card-wrapper.playable button[aria-label$="Skip"]');
    if (skipCard) { skipCard.click(); return "skip"; }
    const playableCard = document.querySelector(".hand-card-wrapper.playable button");
    if (playableCard) { playableCard.click(); return "played"; }
    const drawDeck = document.querySelector(".draw-pile.guidance-pulse");
    if (drawDeck) { drawDeck.click(); return "drawn"; }
    return false;
  })()`);

  const value = played.result.value;
  if (value === "wild") {
    await wait(800);
    await evalScript(cdp, `(() => {
      const modal = document.querySelector(".color-modal");
      if (!modal) return true;
      const red = document.querySelector("[data-testid='wild-color-red']");
      if (red) red.click();
      return true;
    })()`);
    return "wild-picked" as const;
  }
  if (value === "drawn") return "drawn" as const;
  return "played" as const;
}

async function getWinnerName(cdp: Awaited<ReturnType<typeof connectCdp>>) {
  const result = await evalScript(
    cdp,
    '(() => { const h1 = document.querySelector(".winner-podium-box h1"); return h1 ? h1.textContent : null; })()',
  );
  return typeof result.result.value === "string" ? result.result.value : null;
}

async function playGame(cdp: Awaited<ReturnType<typeof connectCdp>>, label: string) {
  await navigate(cdp, appUrl);
  await joinGame(cdp, `E2E-${label}`);
  await waitFor(cdp, 'document.querySelector(".table-board .card-sprite") !== null', 30000);
  await screenshot(cdp, `${SHOT_DIR}/game-${label}-00-start.png`);

  let turns = 0;
  const maxTurns = 200;
  while (turns < maxTurns) {
    const result = await playOneTurn(cdp);
    if (result === "game-over") {
      await screenshot(cdp, `${SHOT_DIR}/game-${label}-winner.png`);
      const winner = await getWinnerName(cdp);
      assert.ok(winner, "Winner should be displayed");
      assert.ok(winner.length > 0, "Winner name should not be empty");
      return winner;
    }
    if (result === "waiting") {
      await wait(1000);
      continue;
    }
    turns += 1;
    await wait(300);
  }

  throw new Error(`Game ${label} did not finish within ${maxTurns} turns`);
}

test("full game loop - lobby to winner", async () => {
  await startStack();
  const browser = await openChrome();
  const cdp = await connectCdp(DEBUG_PORT);

  try {
    await setViewport(cdp, 1280, 720);
    const winner = await playGame(cdp, "desktop");
    assert.ok(winner);
    await checkClean(cdp, "desktop");
  } finally {
    cdp.close();
    cleanupChrome(browser);
    cleanup();
  }
});

test("a second browser session can join cleanly", async () => {
  await startStack();
  const browser = await openChrome();
  const cdp = await connectCdp(DEBUG_PORT);

  try {
    await setViewport(cdp, 1280, 720);
    await navigate(cdp, appUrl);
    await joinGame(cdp, "E2E-second");
    await waitFor(cdp, 'document.querySelector(".game-shell") !== null', 30000);
    await screenshot(cdp, `${SHOT_DIR}/second-session-game-shell.png`);
    await checkClean(cdp, "second-session");
  } finally {
    cdp.close();
    cleanupChrome(browser);
    cleanup();
  }
});
