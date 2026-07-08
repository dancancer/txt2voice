// 一旦我被更新，请更新我的开头注释
// input: Book metadata/checkpoint patch
// output: 自动编排 checkpoint 读写结果
// pos: 自动编排 checkpoint 持久化模块
import prisma from "@/lib/prisma";
import { jsonMetadata, jsonObject } from "@/lib/processing-task-utils";
import {
  toInputJsonValue,
  type AutoPipelineCheckpointMap,
  type AutoPipelineCheckpointPatch,
} from "./common";

const readCheckpoints = (metadata: unknown): AutoPipelineCheckpointMap => {
  const root = jsonObject(metadata as any);
  const autoPipeline = jsonMetadata(root.autoPipeline) || {};
  return jsonMetadata(autoPipeline.checkpoints) as AutoPipelineCheckpointMap;
};

export const readPipelineCheckpoints = async (
  bookId: string
): Promise<AutoPipelineCheckpointMap> => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { metadata: true },
  });

  return readCheckpoints(book?.metadata);
};

export const applyCheckpointPatch = async ({
  bookId,
  patch,
}: {
  bookId: string;
  patch: AutoPipelineCheckpointPatch;
}): Promise<AutoPipelineCheckpointMap> => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { metadata: true },
  });

  const root = jsonObject(book?.metadata);
  const autoPipeline = jsonMetadata(root.autoPipeline) || {};
  const checkpoints = {
    ...readCheckpoints(book?.metadata),
    ...patch.checkpoints,
  };

  await prisma.book.update({
    where: { id: bookId },
    data: {
      metadata: toInputJsonValue({
        ...root,
        autoPipeline: {
          ...autoPipeline,
          checkpoints,
        },
      }),
    },
  });

  return checkpoints;
};
