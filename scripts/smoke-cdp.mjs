import { execSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
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
} from "./browser-cdp-helper.mjs";

const ROOT_DIR = resolve(new URL("..", import.meta.url).pathname);
const SERVER_DIR = resolve(ROOT_DIR, "server");
const CLIENT_DIR = resolve(ROOT_DIR, "web-react");
const SHOT_DIR = resolve(ROOT_DIR, ".tmp-cdp-smoke");
const APP_HOST = process.env.APP_HOST || "127.0.0.1";
let APP_PORT = process.env.APP_PORT || "5173";
let appUrl = process.env.APP_URL || `http://${APP_HOST}:${APP_PORT}`;
const API_URL = process.env.API_URL || "http://127.0.0.1:2567";
const DEBUG_PORT = allocateDebugPort();
const CHROME_BIN = resolveChromeBinary();

mkdirSync(SHOT_DIR, { recursive: true });

const processes = [];

function startProcess(command, args, options = {}) {
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

async function ensureGameReady() {
  await waitFor(cdp, 'document.querySelector(".game-shell") !== null', 30000);
  await wait(1000);
}

async function assertCoachCopy(cdp, label) {
  await waitFor(cdp, 'document.querySelector(".table-coach-eyebrow") !== null', 15000);
  const result = await evalScript(
    cdp,
    `(() => {
      const eyebrow = document.querySelector(".table-coach-eyebrow");
      const title = document.querySelector(".table-coach strong");
      const eyebrowText = eyebrow ? (eyebrow.textContent || "").trim() : "";
      const titleText = title ? (title.textContent || "").trim() : "";
      return {
        eyebrowText,
        titleText,
        ok: ["Waiting", "Penalty turn", "UNO check", "Ready to play", "No legal play", "Your turn"].includes(eyebrowText),
      };
    })()`,
  );
  if (!result.result.value?.ok) {
    throw new Error(
      `Unexpected coach copy for ${label}: eyebrow="${result.result.value?.eyebrowText}" title="${result.result.value?.titleText}"`,
    );
  }
}

async function quickGame(cdp, name) {
  await fill(cdp, 'input[placeholder="Enter your player name"]', name);
  await click(cdp, ".primary-btn");
  await ensureGameReady();
}

async function exerciseOverlayStates(cdp) {
  await click(cdp, '[data-testid="topbar-rules"]');
  await waitFor(cdp, 'document.querySelector(".drawer-content") !== null');
  await waitFor(
    cdp,
    `(() => {
      const heading = document.querySelector("#rules-drawer-title");
      return !!heading && (heading.textContent || "").trim() === "Rules & shortcuts";
    })()`,
  );

  await click(cdp, '[data-testid="rules-replay-guide"]');
  await waitFor(cdp, 'document.querySelector(".first-game-guide") !== null');

  await click(cdp, '[data-testid="tutorial-skip"]');
  await waitFor(cdp, 'document.querySelector(".first-game-guide") === null');

  await click(cdp, '[data-testid="topbar-rules"]');
  await waitFor(cdp, 'document.querySelector(".drawer-content") !== null');

  await click(cdp, '[data-testid="rules-close"]');
  await waitFor(cdp, 'document.querySelector(".drawer-content") === null');
}

async function simulatePlay(cdp, label) {
  await waitFor(cdp, 'document.querySelector(".table-board .card-sprite") !== null', 15000);
  await screenshot(cdp, `${SHOT_DIR}/web-react-game-${label}-0-initial.png`);

  const hasPlay = await evalScript(
    cdp,
    'document.querySelector(".hand-card-wrapper.playable") !== null || document.querySelector(".draw-pile.guidance-pulse") !== null',
  );
  if (!hasPlay.result.value) {
    await screenshot(cdp, `${SHOT_DIR}/web-react-game-${label}-1-waiting-turn.png`);
    await screenshot(cdp, `${SHOT_DIR}/web-react-game-${label}-2-waiting-turn.png`);
    return;
  }

  await evalScript(cdp, `(() => {
    const wildCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$='Wild']");
    if (wildCard) return wildCard.click();
    const wildDraw4 = document.querySelector(".hand-card-wrapper.playable button[aria-label$='Wild +4']");
    if (wildDraw4) return wildDraw4.click();
    const reverseCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$='Reverse']");
    if (reverseCard) return reverseCard.click();
    const skipCard = document.querySelector(".hand-card-wrapper.playable button[aria-label$='Skip']");
    if (skipCard) return skipCard.click();
    const playableCard = document.querySelector(".hand-card-wrapper.playable button");
    if (playableCard) return playableCard.click();
    const drawDeck = document.querySelector(".draw-pile.guidance-pulse");
    if (drawDeck) return drawDeck.click();
    return false;
  })()`);

  await wait(800);
  await evalScript(cdp, `(() => {
    const modal = document.querySelector(".color-modal");
    if (!modal) return true;
    const red = document.querySelector("[data-testid='wild-color-red']");
    if (red) red.click();
    return true;
  })()`);
  await screenshot(cdp, `${SHOT_DIR}/web-react-game-${label}-1-selected.png`);

  await evalScript(cdp, `(() => {
    const selected = document.querySelector(".hand-card-wrapper.playable.keyboard-focused button");
    if (selected) selected.click();
    return true;
  })()`);
  await wait(2500);
  await screenshot(cdp, `${SHOT_DIR}/web-react-game-${label}-2-played.png`);
}

async function assertMobileViewport(cdp) {
  const result = await evalScript(
    cdp,
    `(() => {
      const topbarInfo = document.querySelector(".topbar-info");
      if (!topbarInfo) return false;
      const style = getComputedStyle(topbarInfo);
      return window.matchMedia("(max-width: 640px)").matches && style.display === "grid";
    })()`,
  );
  if (!result.result.value) {
    throw new Error("Mobile viewport assertion failed: expected the responsive top bar grid");
  }
}

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

await startStack();
execSync("npm test -- test/uno.test.ts", { cwd: SERVER_DIR, stdio: "inherit", shell: "/bin/bash" });
const browser = startChrome({
  chromeBin: CHROME_BIN,
  debugPort: DEBUG_PORT,
  userDataDirPrefix: "/tmp/uno-cdp-smoke",
});
await waitForChrome(DEBUG_PORT);
const cdp = await connectCdp(DEBUG_PORT);

await setViewport(cdp, 1280, 720);
await navigate(cdp, appUrl);
await screenshot(cdp, `${SHOT_DIR}/web-react-lobby-desktop.png`);
await quickGame(cdp, "SmokeDesk");
await assertCoachCopy(cdp, "desktop");
await exerciseOverlayStates(cdp);
await simulatePlay(cdp, "desktop");
await checkClean(cdp, "desktop");

await setViewport(cdp, 390, 844);
await navigate(cdp, appUrl);
await waitFor(
  cdp,
  `(() => {
    const label = document.querySelector(".panel-header span");
    return !!label && (label.textContent || "").trim() === "Set up your table";
  })()`,
);
await quickGame(cdp, "SmokeMob");
await assertMobileViewport(cdp);
await simulatePlay(cdp, "mobile");
await checkClean(cdp, "mobile");

cdp.close();
cleanupChrome(browser);
cleanup();
console.log(`Smoke test passed. Screenshots in ${SHOT_DIR}`);
