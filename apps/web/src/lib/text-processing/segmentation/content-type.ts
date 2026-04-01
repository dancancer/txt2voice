/**
 * ============================================
 * 内容类型识别
 * ============================================
 */
export function detectContentType(
  content: string
): "novel" | "article" | "dialogue" | "general" {
  const dialogueRatio = (content.match(/[""「」]/g) || []).length / content.length;
  const chapterMarkers = (
    content.match(/第[一二三四五六七八九十百千万\d]+[章节卷篇部]/g) || []
  ).length;

  if (dialogueRatio > 0.05) {
    return "dialogue";
  }

  if (chapterMarkers > 0) {
    return "novel";
  }

  const paragraphs = content.split(/\n\s*\n/).length;
  if (paragraphs > 5 && content.length / paragraphs < 500) {
    return "article";
  }

  return "general";
}
