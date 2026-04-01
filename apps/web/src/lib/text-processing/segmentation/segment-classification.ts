/**
 * ============================================
 * 分段类型识别
 * ============================================
 */
export function detectSegmentType(
  content: string
): "paragraph" | "dialogue" | "scene" | "chapter" {
  if (
    /^第[一二三四五六七八九十百千万\d]+[章节卷篇部]/.test(content) ||
    /^Chapter\s+\d+/i.test(content) ||
    /^#{1,3}\s+/.test(content)
  ) {
    return "chapter";
  }

  if (
    /^(场景|地点|时间|环境|室内|室外)/.test(content) ||
    /^\[.*?\]$/.test(content) ||
    content.includes("场景：") ||
    content.includes("环境：")
  ) {
    return "scene";
  }

  const dialogueCount = (content.match(/[""「」]/g) || []).length;
  if (dialogueCount > 0 && dialogueCount / content.length > 0.1) {
    return "dialogue";
  }

  return "paragraph";
}
