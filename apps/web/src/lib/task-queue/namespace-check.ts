import type Bull from "bull";

const getQueueRedisKeyPrefix = (queueName: string): string => {
  return `bull:${queueName}`;
};

const getQueuePendingJobCount = async (
  client: {
    llen: (key: string) => Promise<number>;
    zcard: (key: string) => Promise<number>;
  },
  queueName: string
): Promise<number> => {
  const prefix = getQueueRedisKeyPrefix(queueName);
  const [waitCount, activeCount, pausedCount, delayedCount] = await Promise.all([
    client.llen(`${prefix}:wait`),
    client.llen(`${prefix}:active`),
    client.llen(`${prefix}:paused`),
    client.zcard(`${prefix}:delayed`),
  ]);

  return (
    Number(waitCount || 0) +
    Number(activeCount || 0) +
    Number(pausedCount || 0) +
    Number(delayedCount || 0)
  );
};

export async function warnIfLegacyNamespaceHasPendingJobs(
  queue: Bull.Queue<unknown>,
  currentNamespace: string,
  legacyNamespace: string
): Promise<void> {
  if (currentNamespace === legacyNamespace) {
    return;
  }

  try {
    const client = queue.client as {
      llen: (key: string) => Promise<number>;
      zcard: (key: string) => Promise<number>;
    } | null;

    if (!client) {
      return;
    }

    const legacyScriptQueue = `${legacyNamespace}:script-generation`;
    const legacyAudioQueue = `${legacyNamespace}:audio-generation`;

    const [legacyScriptPending, legacyAudioPending] = await Promise.all([
      getQueuePendingJobCount(client, legacyScriptQueue),
      getQueuePendingJobCount(client, legacyAudioQueue),
    ]);

    if (legacyScriptPending + legacyAudioPending === 0) {
      return;
    }

    console.warn("[task-queue] detected pending jobs in legacy namespace", {
      currentNamespace,
      legacyNamespace,
      legacyScriptPending,
      legacyAudioPending,
      suggestion:
        "如果本机同时运行多个实例，请为每个实例配置唯一的 TASK_QUEUE_NAMESPACE",
    });
  } catch (error) {
    console.warn("[task-queue] legacy namespace check failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
