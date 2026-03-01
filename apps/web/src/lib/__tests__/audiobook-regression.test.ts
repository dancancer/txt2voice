// 一旦我被更新，请更新我的开头注释
// input: 回归样本文本/分段参数
// output: 固定回归断言
// pos: 单元测试
import { readFileSync } from "fs";
import { join } from "path";
import { createChapterSegmentRecords } from "../text-processor";

type FixtureCase = {
  fileName: string;
  minChapters: number;
  minSegments: number;
};

const FIXTURE_DIR = join(process.cwd(), "src/test-fixtures/regression");

const FIXTURES: FixtureCase[] = [
  { fileName: "short-dialogue.txt", minChapters: 2, minSegments: 2 },
  { fileName: "multi-role-scene.txt", minChapters: 3, minSegments: 3 },
  { fileName: "long-narrative.txt", minChapters: 4, minSegments: 4 },
];

describe("audiobook regression fixtures", () => {
  it.each(FIXTURES)(
    "should keep chapter/segment invariants for $fileName",
    ({ fileName, minChapters, minSegments }) => {
      const content = readFileSync(join(FIXTURE_DIR, fileName), "utf8");
      const result = createChapterSegmentRecords("book-regression", content, {
        maxSegmentLength: 1200,
        minSegmentLength: 40,
        preserveFormatting: true,
      });

      expect(result.chapterRecords.length).toBeGreaterThanOrEqual(minChapters);
      expect(result.segmentRecords.length).toBeGreaterThanOrEqual(minSegments);
      expect(result.statistics.totalChapters).toBe(result.chapterRecords.length);
      expect(result.statistics.totalSegments).toBe(result.segmentRecords.length);

      const expectedOrder = Array.from(
        { length: result.segmentRecords.length },
        (_, index) => index
      );
      expect(result.segmentRecords.map((segment) => segment.orderIndex)).toEqual(
        expectedOrder
      );

      for (const segment of result.segmentRecords) {
        expect(segment.content.trim().length).toBeGreaterThan(0);
        expect(segment.endPosition).toBeGreaterThan(segment.startPosition);
        expect(segment.chapterOrderIndex).not.toBeNull();

        const metadata =
          segment.metadata && typeof segment.metadata === "object"
            ? (segment.metadata as Record<string, unknown>)
            : {};

        expect(typeof metadata.chapterTitle).toBe("string");
        expect(metadata.chapterOrderIndex).toBe(segment.chapterOrderIndex);
      }

      for (const chapter of result.chapterRecords) {
        const chapterSegments = result.segmentRecords.filter(
          (segment) => segment.chapterId === chapter.id
        );

        expect(chapterSegments.length).toBe(chapter.totalSegments);
        const startPosition = chapter.startPosition ?? 0;
        const endPosition = chapter.endPosition ?? startPosition;
        expect(endPosition).toBeGreaterThanOrEqual(startPosition);

        const chapterOrders = chapterSegments
          .map((segment) => segment.chapterOrderIndex)
          .filter((value): value is number => typeof value === "number");

        expect(chapterOrders[0]).toBe(0);
        expect(chapterOrders).toEqual(
          Array.from({ length: chapterOrders.length }, (_, index) => index)
        );
      }
    }
  );
});
