export function parseJsonResponse(text: string): unknown | null {
  if (!text) return null;

  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/```$/, "");
    cleaned = cleaned.trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue to extraction
  }

  const braceStart = cleaned.indexOf("{");
  const bracketStart = cleaned.indexOf("[");

  if (braceStart >= 0 && (bracketStart < 0 || braceStart < bracketStart)) {
    const braceEnd = cleaned.lastIndexOf("}");
    if (braceEnd >= 0) {
      cleaned = cleaned.slice(braceStart, braceEnd + 1);
    }
  } else if (bracketStart >= 0) {
    const bracketEnd = cleaned.lastIndexOf("]");
    if (bracketEnd >= 0) {
      cleaned = cleaned.slice(bracketStart, bracketEnd + 1);
    }
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export function parseJsonList(text: string): unknown[] {
  const result = parseJsonResponse(text);
  if (Array.isArray(result)) return result;
  return [];
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
  const result = parseJsonResponse(text);
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return null;
}

export function extractJsonBlocks(text: string): string[] {
  const blocks: string[] = [];
  let inBlock = false;
  let current: string[] = [];
  let depth = 0;

  for (const line of text.split("\n")) {
    const stripped = line.trim();

    if (stripped.startsWith("```")) {
      if (inBlock) {
        blocks.push(current.join("\n"));
        current = [];
        inBlock = false;
      } else if (stripped === "```json" || stripped === "```javascript" || stripped === "```") {
        inBlock = true;
      }
      continue;
    }

    if (inBlock || stripped.startsWith("{") || stripped.startsWith("[")) {
      inBlock = true;
    }

    if (inBlock) {
      current.push(line);

      for (const char of stripped) {
        if (char === "{" || char === "[") depth++;
        if (char === "}" || char === "]") depth--;
      }

      if (depth === 0 && current.length > 0) {
        blocks.push(current.join("\n"));
        current = [];
        inBlock = false;
      }
    }
  }

  if (current.length > 0) {
    blocks.push(current.join("\n"));
  }

  return blocks;
}

export function cleanJsonString(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*.*?\*\//gs, "")
    .trim();
}