// 一旦我被更新，请更新我的开头注释
// input: 角色记忆/角色候选/角色档案
// output: character utils 对外导出
// pos: script production storage
/**
 * 角色存储工具导出入口
 */

export { addCharacterToMap, buildCharacterMap, mapCharacterMemoryToCandidates, resolveCandidateCanonicalName } from "./character-utils/mapping";
export { normalizeCharacterCandidates, parseAgeHint } from "./character-utils/normalize";
export { upsertCharacterCandidates } from "./character-utils/upsert";
