import * as iconv from "iconv-lite";

import { logger } from "../../logger";

/**
 * ============================================
 * 编码检测
 * ============================================
 */
export function detectEncoding(buffer: Buffer): string {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    logger.debug("Detected UTF-8 BOM");
    return "utf8";
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    logger.debug("Detected UTF-16LE BOM");
    return "utf16le";
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    logger.debug("Detected UTF-16BE BOM");
    return "utf16be";
  }

  const encodings = [
    { name: "utf8", decoder: (buf: Buffer) => buf.toString("utf8") },
    { name: "gbk", decoder: (buf: Buffer) => iconv.decode(buf, "gbk") },
    { name: "gb2312", decoder: (buf: Buffer) => iconv.decode(buf, "gb2312") },
    { name: "utf16le", decoder: (buf: Buffer) => buf.toString("utf16le") },
    { name: "big5", decoder: (buf: Buffer) => iconv.decode(buf, "big5") },
  ];

  let bestEncoding = "utf8";
  let bestScore = 0;

  for (const { name, decoder } of encodings) {
    try {
      const decoded = decoder(buffer);
      if (!decoded || decoded.trim().length === 0) {
        continue;
      }

      let score = 0;
      const hasGarbage = decoded.includes("�") || decoded.includes("\ufffd");
      if (hasGarbage) {
        continue;
      }
      score += 10;

      const chineseChars = (
        decoded.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []
      ).length;
      if (chineseChars > 0) {
        score += (chineseChars / decoded.length) * 100;
      }

      const englishChars = (decoded.match(/[a-zA-Z]/g) || []).length;
      if (englishChars > 0) {
        score += (englishChars / decoded.length) * 10;
      }

      const punctuation = (
        decoded.match(/[，。！？；：""''（）【】《》、]/g) || []
      ).length;
      if (punctuation > 0) {
        score += (punctuation / decoded.length) * 50;
      }

      const unprintable = (
        decoded.match(
          /[^\x09\x0A\x0D\x20-\x7E\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g
        ) || []
      ).length;
      if (unprintable > decoded.length * 0.1) {
        score -= 50;
      }

      logger.debug("Encoding detection", {
        encoding: name,
        score,
        chineseChars,
        englishChars,
        punctuation,
        unprintable,
        preview: decoded.slice(0, 50),
      });

      if (score > bestScore) {
        bestScore = score;
        bestEncoding = name;
      }
    } catch (error) {
      logger.debug("Encoding detection failed", { encoding: name, error });
    }
  }

  logger.info("Detected encoding", { encoding: bestEncoding, score: bestScore });
  return bestEncoding;
}
