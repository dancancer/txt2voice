interface LLMClient {
  callLLM(prompt: string, systemPrompt?: string): Promise<string>;
}

export function extractJsonCandidate(raw: string): string | null {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fencedMatch ? fencedMatch[1] : raw).trim();
  if (!text) {
    return null;
  }

  const start = text.search(/[\[{]/);
  if (start < 0) {
    return null;
  }

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      if (stack.length > 0) {
        stack.pop();
        if (stack.length === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return text.slice(start);
}

const balanceJsonBrackets = (input: string): string => {
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if ((ch === "}" || ch === "]") && stack.length > 0) {
      stack.pop();
    }
  }

  if (stack.length === 0) {
    return input;
  }

  const tail = stack
    .reverse()
    .map((ch) => (ch === "{" ? "}" : "]"))
    .join("");

  return `${input}${tail}`;
};

export function fixJsonSyntax(jsonString: string): string {
  let fixed = jsonString.trim();

  const fencedMatch = fixed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    fixed = fencedMatch[1].trim();
  }

  fixed = fixed.replace(/^\uFEFF/, "");
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");
  fixed = fixed.replace(/,(\s*})/g, "$1");
  fixed = fixed.replace(/}\s*{/g, "},{");
  fixed = fixed.replace(/]\s*{/g, "],{");
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');

  fixed = fixed.replace(/"([^"]*)"/g, (_match, content: string) => {
    const escapedContent = content
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    return `"${escapedContent}"`;
  });

  fixed = fixed.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

  return balanceJsonBrackets(fixed);
}

export async function fixJsonWithLLM(
  llmService: LLMClient,
  brokenJson: string,
  errorMessage: string
): Promise<string> {
  const prompt = `以下是一个格式错误的JSON，请修复它：

错误信息：${errorMessage}

有问题的JSON：
\`\`\`json
${brokenJson.substring(0, 3000)}
\`\`\`

请返回修复后的完整JSON，确保：
1. 语法完全正确
2. 保持原始数据结构
3. 修复所有语法错误
4. 只返回JSON，不要添加其他文字，不要使用Markdown或代码块

修复后的JSON：`;

  const response = await llmService.callLLM(
    prompt,
    "你是一个JSON修复专家，专门修复格式错误的JSON。请确保返回的JSON语法完全正确。"
  );

  try {
    const jsonCandidate = extractJsonCandidate(response);
    if (jsonCandidate) {
      return jsonCandidate;
    }
  } catch (error) {
    console.error("LLM修复失败，返回默认格式:", error);
  }

  return '{"dialogues": [], "characters": []}';
}

export async function parseLLMJsonResult(
  llmService: LLMClient,
  rawResponse: string
): Promise<any> {
  const jsonString = extractJsonCandidate(rawResponse);
  if (!jsonString) {
    throw new Error("无法从LLM响应中提取JSON");
  }

  try {
    return JSON.parse(jsonString);
  } catch (firstError) {
    const errorMessage =
      firstError instanceof Error ? firstError.message : String(firstError);
    console.log("JSON解析失败，尝试本地修复...");

    const fixedJson = fixJsonSyntax(jsonString);
    try {
      const result = JSON.parse(fixedJson);
      console.log("本地修复成功");
      return result;
    } catch (_secondError) {
      console.log("本地修复失败，尝试LLM修复...");
      const llmFixedJson = await fixJsonWithLLM(
        llmService,
        jsonString,
        errorMessage
      );
      const result = JSON.parse(llmFixedJson);
      console.log("LLM修复成功");
      return result;
    }
  }
}
