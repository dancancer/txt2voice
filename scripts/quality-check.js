#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");

const STEP_ORDER = ["lint", "typecheck", "test", "build"];
const PNPM_BIN = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const STEP_DEFINITIONS = {
  lint: {
    title: "Lint",
    description: "静态规则与项目约定检查",
    command: [PNPM_BIN, ["lint"]],
  },
  typecheck: {
    title: "Type Check",
    description: "TypeScript 类型检查",
    command: [PNPM_BIN, ["typecheck"]],
  },
  test: {
    title: "Test",
    description: "单元测试与回归测试入口",
    command: [PNPM_BIN, ["test"]],
  },
  build: {
    title: "Build",
    description: "生产构建验证",
    command: [PNPM_BIN, ["build"]],
  },
};

function printHelp() {
  console.log(`Usage: pnpm qc -- [options]\n\nOptions:\n  --steps lint,typecheck,test,build  只运行指定步骤\n  --continue-on-error                即使某一步失败，也继续执行剩余步骤\n  --help                             显示帮助\n\nExamples:\n  pnpm qc\n  pnpm qc -- --steps lint,typecheck\n  pnpm qc -- --continue-on-error`);
}

function parseArgs(argv) {
  const options = {
    steps: [...STEP_ORDER],
    continueOnError: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--continue-on-error") {
      options.continueOnError = true;
      continue;
    }

    if (arg === "--steps") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--steps 需要一个逗号分隔的步骤列表");
      }
      index += 1;
      options.steps = normalizeSteps(value);
      continue;
    }

    if (arg.startsWith("--steps=")) {
      options.steps = normalizeSteps(arg.slice("--steps=".length));
      continue;
    }

    throw new Error(`不支持的参数: ${arg}`);
  }

  return options;
}

function normalizeSteps(value) {
  const steps = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (steps.length === 0) {
    throw new Error("至少需要一个步骤");
  }

  const invalidSteps = steps.filter((step) => !STEP_DEFINITIONS[step]);
  if (invalidSteps.length > 0) {
    throw new Error(`未知步骤: ${invalidSteps.join(", ")}`);
  }

  return Array.from(new Set(steps));
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function runCommand(step, index, total) {
  const definition = STEP_DEFINITIONS[step];
  const [command, args] = definition.command;
  const startedAt = performance.now();

  console.log(`\n[${index}/${total}] ${definition.title}`);
  console.log(`-> ${definition.description}`);
  console.log(`-> ${command} ${args.join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("close", (code, signal) => {
      const durationMs = performance.now() - startedAt;
      const success = code === 0 && signal === null;

      resolve({
        step,
        success,
        code,
        signal,
        durationMs,
      });
    });
  });
}

function printSummary(results) {
  console.log("\nQuality Check Summary");

  for (const result of results) {
    const mark = result.success ? "[ok]" : "[fail]";
    console.log(
      `${mark} ${result.step.padEnd(10)} ${formatDuration(result.durationMs)}`
    );
  }

  const failed = results.filter((result) => !result.success);
  if (failed.length === 0) {
    console.log("\nAll selected quality gates passed.");
    return;
  }

  console.error(
    `\nFailed steps: ${failed.map((result) => result.step).join(", ")}`
  );
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      printHelp();
      return;
    }

    const results = [];

    for (let index = 0; index < options.steps.length; index += 1) {
      const step = options.steps[index];
      const result = await runCommand(step, index + 1, options.steps.length);
      results.push(result);

      if (!result.success && !options.continueOnError) {
        break;
      }
    }

    printSummary(results);
    const hasFailure = results.some((result) => !result.success);
    process.exit(hasFailure ? 1 : 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Quality check configuration error: ${message}`);
    process.exit(1);
  }
}

main();
