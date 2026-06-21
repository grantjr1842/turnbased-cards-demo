import { execSync, spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

export function resolveChromeBinary() {
  return (
    process.env.BROWSER_BIN ||
    process.env.CHROME_BIN ||
    process.env.CHROMIUM_BIN ||
    execSync("command -v google-chrome || command -v chromium || command -v chromium-browser", {
      encoding: "utf8",
      shell: "/bin/bash",
    }).trim()
  );
}

export function allocateDebugPort() {
  return Number(
    process.env.DEBUG_PORT ||
      execSync(
        `node -e "const s=require('node:net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close();});"`,
        { encoding: "utf8", shell: "/bin/bash" },
      ).trim(),
  );
}

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startChrome({ chromeBin, debugPort, userDataDirPrefix }) {
  const userDataDir = execSync(`mktemp -d ${userDataDirPrefix}.XXXXXX`, {
    encoding: "utf8",
    shell: "/bin/bash",
  }).trim();
  const proc = spawn(
    chromeBin,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  proc.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  proc.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  return { proc, userDataDir };
}

export function cleanupChrome(browser) {
  if (!browser) return;
  if (browser.proc && !browser.proc.killed) {
    browser.proc.kill("SIGTERM");
  }
  if (browser.userDataDir) {
    try {
      execSync(`rm -rf ${JSON.stringify(browser.userDataDir)}`, { stdio: "ignore" });
    } catch {}
  }
}

export async function waitForChrome(debugPort, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      if (res.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error("Chrome did not start");
}

export async function connectCdp(debugPort) {
  const version = await fetch(`http://127.0.0.1:${debugPort}/json/version`).then((res) => res.json());
  if (!version?.webSocketDebuggerUrl) {
    throw new Error("Unable to locate the browser DevTools websocket");
  }

  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const runtimeErrors = [];
  let pageSessionId = null;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || "CDP error"));
      else resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown" && message.sessionId === pageSessionId) {
      runtimeErrors.push(message.params?.exceptionDetails?.text || "Runtime exception");
    }
    if (message.method === "Log.entryAdded" && message.sessionId === pageSessionId) {
      const entry = message.params?.entry;
      if (entry?.level === "error") {
        runtimeErrors.push(entry.text || "Console error");
      }
    }
  });

  async function send(method, params = {}, sessionId = null) {
    const id = ++nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    socket.send(JSON.stringify(payload));
    return await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  const targets = await send("Target.getTargets");
  const pageTarget = targets.targetInfos.find((target) => target.type === "page") ?? targets.targetInfos[0];
  if (!pageTarget) {
    throw new Error("Unable to locate a page target for Chrome DevTools");
  }

  const attached = await send("Target.attachToTarget", {
    targetId: pageTarget.targetId,
    flatten: true,
  });
  pageSessionId = attached.sessionId;

  await send("Runtime.enable", {}, pageSessionId);
  await send("Page.enable", {}, pageSessionId);
  await send("Log.enable", {}, pageSessionId);

  return {
    socket,
    runtimeErrors,
    get pageSessionId() {
      return pageSessionId;
    },
    close() {
      socket.close();
    },
    send,
  };
}

export async function waitFor(cdp, expression, timeoutMs = 15000) {
  const script = `(async () => { const end = Date.now() + ${timeoutMs}; while (Date.now() < end) { try { if (${expression}) return true; } catch (error) {} await new Promise((resolve) => setTimeout(resolve, 100)); } return false; })()`;
  const result = await cdp.send(
    "Runtime.evaluate",
    {
      expression: script,
      awaitPromise: true,
      returnByValue: true,
    },
    cdp.pageSessionId,
  );
  if (!result.result.value) {
    throw new Error(`Timed out waiting for: ${expression}`);
  }
}

export async function navigate(cdp, url) {
  await cdp.send("Page.navigate", { url }, cdp.pageSessionId);
  await waitFor(cdp, "document.readyState === 'complete'", 15000);
}

export async function setViewport(cdp, width, height) {
  await cdp.send(
    "Emulation.setDeviceMetricsOverride",
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    },
    cdp.pageSessionId,
  );
}

export async function evalScript(cdp, expression) {
  return await cdp.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    cdp.pageSessionId,
  );
}

export async function fill(cdp, selector, value) {
  try {
    await waitFor(cdp, `document.querySelector(${JSON.stringify(selector)}) !== null`);
  } catch (error) {
    const href = await evalScript(cdp, "location.href");
    const body = await evalScript(cdp, "document.body ? document.body.innerHTML.slice(0, 600) : null");
    console.error("fill timeout diagnostics:");
    console.error(`  href: ${href.result.value}`);
    console.error(`  body: ${body.result.value}`);
    throw error;
  }
  await evalScript(
    cdp,
    `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (!setter) return false;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
}

export async function click(cdp, selector) {
  await waitFor(cdp, `document.querySelector(${JSON.stringify(selector)}) !== null`);
  await evalScript(
    cdp,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    })()`,
  );
}

export async function screenshot(cdp, filePath) {
  const { data } = await cdp.send(
    "Page.captureScreenshot",
    { format: "png", fromSurface: true },
    cdp.pageSessionId,
  );
  writeFileSync(filePath, Buffer.from(data, "base64"));
}

export async function checkClean(cdp, label) {
  if (cdp.runtimeErrors.some((entry) => /Uncaught|shader|THREE\.Clock/i.test(entry))) {
    throw new Error(`Browser ${label} produced errors:\n${cdp.runtimeErrors.join("\n")}`);
  }
  cdp.runtimeErrors.length = 0;
}
