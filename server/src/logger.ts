type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_LEVEL: LogLevel = "info";

function normalizeLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return DEFAULT_LEVEL;
}

const currentLevel = normalizeLogLevel(process.env.LOG_LEVEL);

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, namespace: string, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${safeStringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] [${namespace}] ${message}${metaStr}`;
}

function safeStringify(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '{"_meta":"unserializable"}';
  }
}

export const logger = {
  debug(namespace: string, message: string, meta?: Record<string, unknown>) {
    if (shouldLog("debug")) {
      console.debug(formatMessage("debug", namespace, message, meta));
    }
  },
  info(namespace: string, message: string, meta?: Record<string, unknown>) {
    if (shouldLog("info")) {
      console.info(formatMessage("info", namespace, message, meta));
    }
  },
  warn(namespace: string, message: string, meta?: Record<string, unknown>) {
    if (shouldLog("warn")) {
      console.warn(formatMessage("warn", namespace, message, meta));
    }
  },
  error(namespace: string, message: string, meta?: Record<string, unknown>) {
    if (shouldLog("error")) {
      console.error(formatMessage("error", namespace, message, meta));
    }
  },
};
