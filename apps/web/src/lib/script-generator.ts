// 一旦我被更新，请更新我的开头注释
// input: 函数参数/外部依赖
// output: 工具/服务导出
// pos: 共享业务库
import { getLLMService } from "./llm-service";
import { resolveScriptGenerationOptions } from "./script-generator/options";
import {
  savePartialScriptToDatabase,
  saveScriptToDatabase,
} from "./script-generator/storage/persistence";
import {
  inferSegment,
  persistSegmentResult,
  processSegmentAndSave,
} from "./script-generator/pipeline/segment-processor";
import {
  generatePartialScriptByBook,
  generateScriptByBook,
  regenerateSegmentsByBook,
} from "./script-generator/pipeline/workflow";
import type {
  GeneratedScript,
  SegmentProcessingResult,
  ScriptGenerationOptions,
} from "./script-generator/types";
import type { LLMExecutionObserver } from "./llm-service";

export type {
  CharacterCandidate,
  DialogueLine,
  GeneratedScript,
  ScriptGenerationOptions,
} from "./script-generator/types";

/**
 * 台本生成器类
 */
export class ScriptGenerator {
  private llmService = getLLMService();

  private async processSegmentAndSave(
    segment: any,
    characterMap: Map<string, string>,
    characterProfiles: any[],
    options: ScriptGenerationOptions,
    bookId: string
  ): Promise<SegmentProcessingResult> {
    return processSegmentAndSave({
      llmService: this.llmService,
      segment,
      characterMap,
      characterProfiles,
      options,
      bookId,
    });
  }

  private async inferSegment(
    segment: any,
    characterMap: Map<string, string>,
    characterProfiles: any[],
    options: ScriptGenerationOptions
  ): Promise<SegmentProcessingResult> {
    return inferSegment({
      llmService: this.llmService,
      segment,
      characterMap,
      characterProfiles,
      options,
    });
  }

  private async persistSegmentResult(
    segment: any,
    result: SegmentProcessingResult,
    characterMap: Map<string, string>,
    characterProfiles: any[],
    bookId: string
  ): Promise<void> {
    return persistSegmentResult({
      bookId,
      segmentId: segment.id,
      result,
      characterMap,
      characterProfiles,
    });
  }

  setExecutionObserver(observer: LLMExecutionObserver | null): void {
    this.llmService.setExecutionObserver(observer);
  }

  /**
   * 生成完整台本
   */
  async generateScript(
    bookId: string,
    options: Partial<ScriptGenerationOptions> = {},
    onProgress?: (done: number, total: number) => Promise<void> | void
  ): Promise<GeneratedScript> {
    const finalOptions = resolveScriptGenerationOptions(options);

    return generateScriptByBook({
      bookId,
      options: finalOptions,
      onProgress,
      processSegment: (input) =>
        this.inferSegment(
          input.segment,
          input.characterMap,
          input.characterProfiles,
          input.options
        ),
      persistSegmentResult: (input) =>
        this.persistSegmentResult(
          input.segment,
          input.result,
          input.characterMap,
          input.characterProfiles,
          input.bookId
        ),
    });
  }

  /**
   * 增量生成台本
   */
  async generatePartialScript(
    bookId: string,
    options: Partial<ScriptGenerationOptions> = {},
    params: {
      startFromSegmentId?: string | null;
      startFromOrderIndex?: number | null;
      limitToSegments?: number;
    } = {},
    onProgress?: (done: number, total: number) => Promise<void> | void
  ): Promise<GeneratedScript> {
    const finalOptions = resolveScriptGenerationOptions(options);

    return generatePartialScriptByBook({
      bookId,
      options: finalOptions,
      generationParams: params,
      onProgress,
      processSegment: (input) =>
        this.inferSegment(
          input.segment,
          input.characterMap,
          input.characterProfiles,
          input.options
        ),
      persistSegmentResult: (input) =>
        this.persistSegmentResult(
          input.segment,
          input.result,
          input.characterMap,
          input.characterProfiles,
          input.bookId
        ),
    });
  }

  /**
   * 重新生成指定段落的台本
   */
  async regenerateSegmentScript(
    bookId: string,
    segmentIds: string[],
    options: Partial<ScriptGenerationOptions> = {},
    onProgress?: (done: number, total: number) => Promise<void> | void
  ): Promise<GeneratedScript> {
    const finalOptions = resolveScriptGenerationOptions(options);

    return regenerateSegmentsByBook({
      bookId,
      segmentIds,
      options: finalOptions,
      onProgress,
      processSegment: (input) =>
        this.inferSegment(
          input.segment,
          input.characterMap,
          input.characterProfiles,
          input.options
        ),
      persistSegmentResult: (input) =>
        this.persistSegmentResult(
          input.segment,
          input.result,
          input.characterMap,
          input.characterProfiles,
          input.bookId
        ),
    });
  }

  /**
   * 保存生成的台本到数据库（增量）
   */
  async savePartialScriptToDatabase(
    bookId: string,
    script: GeneratedScript
  ): Promise<void> {
    await savePartialScriptToDatabase(bookId, script);
  }

  /**
   * 保存生成的台本到数据库（全量）
   */
  async saveScriptToDatabase(
    bookId: string,
    script: GeneratedScript
  ): Promise<void> {
    await saveScriptToDatabase(bookId, script);
  }
}

/**
 * 获取台本生成器实例
 */
export function getScriptGenerator(): ScriptGenerator {
  return new ScriptGenerator();
}
