#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_ROOT = path.join(process.cwd(), "apps/web/src");
const TARGET_EXTENSION = ".tsx";
const CARD_CONTENT_TAG = /<CardContent\b[\s\S]*?>/g;

function collectFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectFiles(fullPath, out);
      continue;
    }

    if (entry.isFile() && fullPath.endsWith(TARGET_EXTENSION)) {
      out.push(fullPath);
    }
  }

  return out;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

function extractClassName(tag) {
  const directMatch =
    tag.match(/className\s*=\s*"([\s\S]*?)"/) ||
    tag.match(/className\s*=\s*'([\s\S]*?)'/) ||
    tag.match(/className\s*=\s*\{\s*`([\s\S]*?)`\s*\}/);

  if (directMatch) {
    return directMatch[1];
  }

  return null;
}

function isTopPaddingShorthandToken(token) {
  const match = token.match(/(?:^|:)!?(p|py)-([^\s]+)/);

  if (!match) {
    return false;
  }

  const value = match[2];

  if (value === "0" || value.startsWith("[0")) {
    return false;
  }

  return true;
}

function hasExplicitPtToken(token) {
  return /(?:^|:)!?pt-[^\s]+/.test(token);
}

function inspectTag(filePath, content, tag, index) {
  if (!/className\s*=/.test(tag)) {
    return null;
  }

  const className = extractClassName(tag);

  if (!className) {
    return {
      type: "warning",
      filePath,
      line: getLineNumber(content, index),
      message:
        "className 不是静态字符串，跳过自动检查，请人工确认 CardContent 顶部内边距是否符合约定",
    };
  }

  const tokens = className
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const hasTopShorthand = tokens.some(isTopPaddingShorthandToken);

  if (!hasTopShorthand) {
    return null;
  }

  const hasPt = tokens.some(hasExplicitPtToken);

  if (hasPt) {
    return null;
  }

  return {
    type: "error",
    filePath,
    line: getLineNumber(content, index),
    message:
      "CardContent 使用了 p-* / py-* 但未显式声明 pt-*，请补充 !pt-* 或 pt-0（有意去掉顶部内边距时）",
  };
}

function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error(`Source directory not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  const files = collectFiles(SOURCE_ROOT);
  const findings = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const matches = content.matchAll(CARD_CONTENT_TAG);

    for (const match of matches) {
      const finding = inspectTag(filePath, content, match[0], match.index ?? 0);

      if (finding) {
        findings.push(finding);
      }
    }
  }

  const errors = findings.filter((finding) => finding.type === "error");
  const warnings = findings.filter((finding) => finding.type === "warning");

  for (const finding of errors) {
    const relativePath = path.relative(process.cwd(), finding.filePath);
    console.error(`ERROR ${relativePath}:${finding.line} - ${finding.message}`);
  }

  for (const finding of warnings) {
    const relativePath = path.relative(process.cwd(), finding.filePath);
    console.warn(`WARN  ${relativePath}:${finding.line} - ${finding.message}`);
  }

  if (errors.length > 0) {
    console.error(`\nCardContent padding review failed: ${errors.length} issue(s)`);
    process.exit(1);
  }

  console.log(`CardContent padding review passed (${files.length} files scanned)`);

  if (warnings.length > 0) {
    console.log(`Manual review warnings: ${warnings.length}`);
  }
}

main();
