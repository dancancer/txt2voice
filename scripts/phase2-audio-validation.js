#!/usr/bin/env node
const fs = require("fs/promises");
const path = require("path");

const DEFAULT_OPTIONS = {
  baseUrl: "http://192.168.88.9:3001",
  provider: "voxcpm",
  type: "chapter",
  repeatCount: 1,
  pollIntervalMs: 5000,
  timeoutMs: 30 * 60 * 1000,
  batchSize: undefined,
  reviewPath: "docs/review/2026-03-18-phase-2-runtime-validation.md",
};

const PHASE_2_VALIDATION_TITLE = "Phase 2 Runtime Validation";

const parseInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} 必须是正整数`);
  }
  return parsed;
};

const parseArgs = (argv) => {
  const options = { ...DEFAULT_OPTIONS };

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) {
      throw new Error(`无法识别的参数: ${entry}`);
    }

    const trimmed = entry.slice(2);
    const equalIndex = trimmed.indexOf("=");
    const key = equalIndex >= 0 ? trimmed.slice(0, equalIndex) : trimmed;
    const inlineValue = equalIndex >= 0 ? trimmed.slice(equalIndex + 1) : null;
    const value =
      inlineValue !== null
        ? inlineValue
        : argv[index + 1] && !argv[index + 1].startsWith("--")
          ? argv[++index]
          : "true";

    switch (key) {
      case "base-url":
        options.baseUrl = value;
        break;
      case "provider":
        options.provider = value;
        break;
      case "type":
        options.type = value;
        break;
      case "book-id":
        options.bookId = value;
        break;
      case "chapter-id":
        options.chapterId = value;
        break;
      case "batch-size":
        options.batchSize = parseInteger(value, "batch-size");
        break;
      case "repeat-count":
        options.repeatCount = parseInteger(value, "repeat-count");
        break;
      case "poll-interval-ms":
        options.pollIntervalMs = parseInteger(value, "poll-interval-ms");
        break;
      case "timeout-ms":
        options.timeoutMs = parseInteger(value, "timeout-ms");
        break;
      case "review-path":
        options.reviewPath = value;
        break;
      default:
        throw new Error(`不支持的参数: --${key}`);
    }
  }

  if (!options.bookId) {
    throw new Error("必须提供 --book-id");
  }

  if (options.type !== "book" && options.type !== "chapter") {
    throw new Error("--type 只支持 book 或 chapter");
  }

  if (options.type === "chapter" && !options.chapterId) {
    throw new Error("当 --type=chapter 时必须提供 --chapter-id");
  }

  return options;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = async (fetchImpl, url, init) => {
  const response = await fetchImpl(url, init);
  const payload = await response.json().catch(async () => {
    const text = typeof response.text === "function" ? await response.text() : "";
    throw new Error(`响应不是合法 JSON: ${text}`);
  });

  if (!response.ok) {
    const errorMessage =
      payload?.error?.message ||
      payload?.message ||
      `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  if (payload?.success === false) {
    const errorMessage = payload?.error?.message || payload?.message || "请求失败";
    throw new Error(errorMessage);
  }

  return payload;
};

const resolveRunVerdict = (status, metadata) => {
  if (status === "failed") {
    return "failed";
  }

  const failedCount =
    metadata && Number.isFinite(Number(metadata.failedCount))
      ? Number(metadata.failedCount)
      : 0;

  if (status === "completed" && failedCount > 0) {
    return "partial_failure";
  }

  if (status === "completed") {
    return "completed";
  }

  return "failed";
};

const resolveOverallVerdict = (runs) => {
  if (runs.some((run) => run.verdict === "probe_failed")) {
    return "probe_failed";
  }
  if (runs.some((run) => run.verdict === "failed")) {
    return "failed";
  }
  if (runs.some((run) => run.verdict === "partial_failure")) {
    return "partial_failure";
  }
  return "completed";
};

const pollAudioGeneration = async (options, deps) => {
  const startedAt = Date.now();
  const statusUrl = `${options.baseUrl}/api/books/${options.bookId}/audio/generate?includeProgress=true`;

  while (Date.now() - startedAt < options.timeoutMs) {
    const payload = await requestJson(deps.fetch, statusUrl, {
      method: "GET",
    });
    const data = payload.data || {};
    const generationStatus = data.generationStatus;
    const taskDetails = data.taskDetails || null;

    if (generationStatus === "completed" || generationStatus === "failed") {
      return {
        generationStatus,
        taskDetails,
        elapsedMs: Date.now() - startedAt,
      };
    }

    await deps.sleep(options.pollIntervalMs);
  }

  throw new Error(`音频生成轮询超时: ${options.timeoutMs}ms`);
};

const buildAudioGeneratePayload = (options) => ({
  type: options.type,
  ...(options.type === "chapter" ? { chapterId: options.chapterId } : {}),
  autoMerge: false,
  options: {
    provider: options.provider,
    skipExisting: false,
    overwriteExisting: true,
    ...(options.batchSize ? { batchSize: options.batchSize } : {}),
  },
});

const runSingleValidation = async (options, deps, runIndex) => {
  const probePayload = await requestJson(
    deps.fetch,
    `${options.baseUrl}/api/tts/providers/status?probe=true`,
    { method: "GET" }
  );

  const providerProbe = (probePayload.data?.providers || []).find(
    (provider) => provider.provider === options.provider
  );

  if (!providerProbe) {
    return {
      runId: `run-${runIndex + 1}`,
      verdict: "probe_failed",
      probe: {
        provider: options.provider,
        healthy: false,
        probeHealthy: false,
        message: "目标 provider 不存在",
      },
      taskId: null,
      generationStatus: "not_started",
      audioReliability: null,
    };
  }

  const probe = {
    provider: providerProbe.provider,
    healthy: providerProbe.healthy === true,
    probeHealthy: providerProbe.probeHealthy === true,
    message: providerProbe.probeMessage || providerProbe.message || "未知状态",
    checkedAt: providerProbe.probeCheckedAt || null,
  };

  if (!Object.prototype.hasOwnProperty.call(providerProbe, "probeHealthy")) {
    probe.probeHealthy = false;
    probe.message = "目标服务未返回 probe 字段，疑似尚未部署 Phase 2 Round 1 代码";
  }

  if (!probe.healthy || !probe.probeHealthy) {
    return {
      runId: `run-${runIndex + 1}`,
      verdict: "probe_failed",
      probe,
      taskId: null,
      generationStatus: "not_started",
      audioReliability: null,
    };
  }

  const startPayload = await requestJson(
    deps.fetch,
    `${options.baseUrl}/api/books/${options.bookId}/audio/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildAudioGeneratePayload(options)),
    }
  );

  const polled = await pollAudioGeneration(options, deps);
  const metadata = polled.taskDetails?.metadata || null;

  return {
    runId: `run-${runIndex + 1}`,
    verdict: resolveRunVerdict(polled.generationStatus, metadata),
    probe,
    taskId: startPayload.data?.taskId || polled.taskDetails?.id || null,
    generationStatus: polled.generationStatus,
    elapsedMs: polled.elapsedMs,
    audioReliability: metadata?.audioReliability || null,
    metadata,
  };
};

const runPhase2AudioValidation = async (rawOptions, providedDeps = {}) => {
  const options = {
    ...DEFAULT_OPTIONS,
    ...rawOptions,
  };
  const deps = {
    fetch: providedDeps.fetch || global.fetch,
    sleep: providedDeps.sleep || sleep,
  };

  if (typeof deps.fetch !== "function") {
    throw new Error("当前环境没有可用的 fetch 实现");
  }

  const runs = [];

  for (let runIndex = 0; runIndex < options.repeatCount; runIndex += 1) {
    const run = await runSingleValidation(options, deps, runIndex);
    runs.push(run);

    if (run.verdict === "probe_failed") {
      break;
    }
  }

  return {
    title: PHASE_2_VALIDATION_TITLE,
    executedAt: new Date().toISOString(),
    config: {
      baseUrl: options.baseUrl,
      provider: options.provider,
      type: options.type,
      bookId: options.bookId,
      chapterId: options.chapterId || null,
      batchSize: options.batchSize || null,
      repeatCount: options.repeatCount,
      timeoutMs: options.timeoutMs,
      pollIntervalMs: options.pollIntervalMs,
    },
    runs,
    overallVerdict: resolveOverallVerdict(runs),
  };
};

const buildProviderFailuresLine = (audioReliability) => {
  const failures = Array.isArray(audioReliability?.providerFailures)
    ? audioReliability.providerFailures
    : [];

  if (failures.length === 0) {
    return "`[]`";
  }

  return failures
    .map((entry) => `${entry.provider}:${entry.failed}`)
    .join(", ");
};

const buildPhase2ValidationReviewMarkdown = (result) => {
  const lines = [
    `# ${PHASE_2_VALIDATION_TITLE}`,
    "",
    "## 基本信息",
    "",
    `- 日期：${result.executedAt.slice(0, 10)}`,
    `- baseUrl：\`${result.config.baseUrl}\``,
    `- provider：\`${result.config.provider}\``,
    `- type：\`${result.config.type}\``,
    `- bookId：\`${result.config.bookId}\``,
    `- chapterId：\`${result.config.chapterId || "N/A"}\``,
    `- batchSize：\`${result.config.batchSize ?? "default"}\``,
    `- repeatCount：\`${result.config.repeatCount}\``,
    `- overallVerdict：\`${result.overallVerdict}\``,
    "",
    "## 运行记录",
    "",
    "| Run ID | Probe | Task ID | Status | Verdict | firstPassSuccessRate | retryRounds | averageDurationMs | providerFailures | 备注 |",
    "|---|---|---|---|---|---:|---:|---:|---|---|",
  ];

  for (const run of result.runs) {
    const reliability = run.audioReliability || {};
    lines.push(
      `| \`${run.runId}\` | \`${run.probe?.healthy === true && run.probe?.probeHealthy === true ? "pass" : "fail"}\` | \`${run.taskId || "N/A"}\` | \`${run.generationStatus}\` | \`${run.verdict}\` | ${reliability.firstPassSuccessRate ?? "N/A"} | ${reliability.retryRounds ?? "N/A"} | ${reliability.averageDurationMs ?? "N/A"} | ${buildProviderFailuresLine(reliability)} | ${run.probe?.message || "N/A"} |`
    );
  }

  lines.push(
    "",
    "## 结论",
    "",
    `- 本轮结论：\`${result.overallVerdict}\``,
    `- 说明：当前脚本以 provider probe + AUDIO_GENERATION task metadata.audioReliability 作为 Phase 2 验收事实源。`
  );

  return lines.join("\n");
};

const writeReviewMarkdown = async (reviewPath, markdown, fileSystem = fs) => {
  const absolutePath = path.resolve(reviewPath);
  await fileSystem.mkdir(path.dirname(absolutePath), { recursive: true });
  await fileSystem.writeFile(absolutePath, `${markdown}\n`, "utf8");
  return absolutePath;
};

const buildFailureMarkdown = (options, error) =>
  [
    `# ${PHASE_2_VALIDATION_TITLE}`,
    "",
    "## 基本信息",
    "",
    `- 日期：${new Date().toISOString().slice(0, 10)}`,
    `- provider：\`${options.provider}\``,
    `- type：\`${options.type}\``,
    `- bookId：\`${options.bookId || "N/A"}\``,
    `- chapterId：\`${options.chapterId || "N/A"}\``,
    "",
    "## 失败",
    "",
    `- 错误：${error instanceof Error ? error.message : String(error)}`,
  ].join("\n");

const main = async (argv = process.argv.slice(2), providedDeps = {}) => {
  const options = parseArgs(argv);

  try {
    const result = await runPhase2AudioValidation(options, providedDeps);
    const markdown = buildPhase2ValidationReviewMarkdown(result);
    const reviewPath = await writeReviewMarkdown(
      options.reviewPath,
      markdown,
      providedDeps.fs || fs
    );

    console.log(markdown);
    console.log(`\nReview written to ${reviewPath}`);

    if (result.overallVerdict !== "completed") {
      process.exitCode = 1;
    }

    return result;
  } catch (error) {
    const failureMarkdown = buildFailureMarkdown(options, error);
    if (options.reviewPath) {
      await writeReviewMarkdown(options.reviewPath, failureMarkdown, providedDeps.fs || fs);
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    throw error;
  }
};

module.exports = {
  parseArgs,
  runPhase2AudioValidation,
  buildPhase2ValidationReviewMarkdown,
  main,
};

if (require.main === module) {
  main().catch(() => {});
}
