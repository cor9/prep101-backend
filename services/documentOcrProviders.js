const fetch = require("node-fetch");
const FormData = require("form-data");

const LLAMA_PARSE_INSTRUCTION =
  "You are analyzing a Hollywood screenplay. Ignore any remaining diagonal watermarks. Do not extract text that has been crossed out with thick lines. Identify handwritten 'START' and 'END' markers.";

function asStructuredBlock({
  text = "",
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  page = 1,
  pageWidth = 0,
  pageHeight = 0,
}) {
  return {
    text,
    bbox: { x, y, width, height },
    page,
    pageWidth,
    pageHeight,
  };
}

function normalizeMistralPayload(payload = {}) {
  const pages = payload.pages || payload.data?.pages || [];
  const blocks = [];

  pages.forEach((page, pageIndex) => {
    const pageNum = page.page || pageIndex + 1;
    const pageWidth = page.width || page.dimensions?.width || 0;
    const pageHeight = page.height || page.dimensions?.height || 0;
    const words = page.words || page.blocks || page.lines || [];

    words.forEach((node) => {
      const box = node.bbox || node.box || node.bounding_box || {};
      blocks.push(
        asStructuredBlock({
          text: node.text || node.content || "",
          x: box.x || box.left || 0,
          y: box.y || box.top || 0,
          width: box.width || (box.right && box.left ? box.right - box.left : 0),
          height: box.height || (box.bottom && box.top ? box.bottom - box.top : 0),
          page: pageNum,
          pageWidth,
          pageHeight,
        })
      );
    });
  });

  return blocks;
}

function normalizeLlamaPayload(payload = {}) {
  const pages = payload.pages || payload.result?.pages || [];
  const blocks = [];

  pages.forEach((page, pageIndex) => {
    const pageNum = page.page || page.page_number || pageIndex + 1;
    const pageWidth = page.width || page.page_width || 0;
    const pageHeight = page.height || page.page_height || 0;
    const items = page.items || page.blocks || page.tokens || [];

    items.forEach((item) => {
      const box = item.bbox || item.bounding_box || {};
      blocks.push(
        asStructuredBlock({
          text: item.text || item.content || "",
          x: box.x || box.left || 0,
          y: box.y || box.top || 0,
          width: box.width || (box.right && box.left ? box.right - box.left : 0),
          height: box.height || (box.bottom && box.top ? box.bottom - box.top : 0),
          page: pageNum,
          pageWidth,
          pageHeight,
        })
      );
    });
  });

  return blocks;
}

async function extractWithMistralOcr(purifiedPages = []) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not configured.");
  }
  if (!purifiedPages.length) {
    throw new Error("No purified pages provided for Mistral OCR.");
  }

  const url = process.env.MISTRAL_OCR_URL || "https://api.mistral.ai/v1/ocr";
  const model = process.env.MISTRAL_OCR_MODEL || "mistral-ocr-2512";
  const form = new FormData();
  form.append("model", model);
  form.append("response_format", "json");

  purifiedPages.forEach((page, index) => {
    form.append(`file_${index + 1}`, page.imageBuffer, {
      filename: `page-${page.page || index + 1}.png`,
      contentType: "image/png",
    });
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
    timeout: 120000,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mistral OCR failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const blocks = normalizeMistralPayload(payload);

  if (!blocks.length) {
    throw new Error("Mistral OCR returned no text blocks.");
  }

  return {
    provider: "mistral-ocr-2512",
    blocks,
    raw: payload,
  };
}

async function extractWithLlamaParse(purifiedPages = []) {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY || process.env.LLAMA_PARSE_API_KEY;
  if (!apiKey) {
    throw new Error("LLAMA_CLOUD_API_KEY is not configured.");
  }
  if (!purifiedPages.length) {
    throw new Error("No purified pages provided for LlamaParse.");
  }

  const sdkOptions = {
    apiKey,
    parserOptions: {
      premium_mode: true,
      parsing_instruction: LLAMA_PARSE_INSTRUCTION,
      output_format: "json",
      include_bbox: true,
    },
  };

  try {
    const { LlamaCloudIndex } = require("@llamaindex/llama-cloud");
    const parser = new LlamaCloudIndex(sdkOptions);
    const responses = [];
    for (const page of purifiedPages) {
      const result = await parser.parseFile({
        file: page.imageBuffer,
        filename: `page-${page.page}.png`,
        mimeType: "image/png",
      });
      responses.push(result);
    }

    const joined = { pages: responses.flatMap((r) => r.pages || []) };
    const blocks = normalizeLlamaPayload(joined);
    if (!blocks.length) {
      throw new Error("LlamaParse SDK returned no text blocks.");
    }
    return {
      provider: "llamaparse-premium",
      blocks,
      raw: joined,
    };
  } catch (sdkError) {
    const fallbackUrl =
      process.env.LLAMA_PARSE_URL || "https://api.cloud.llamaindex.ai/api/parsing/upload";
    const form = new FormData();
    form.append("premium_mode", "true");
    form.append("parsing_instruction", LLAMA_PARSE_INSTRUCTION);
    form.append("include_bbox", "true");
    form.append("output_format", "json");

    purifiedPages.forEach((page, index) => {
      form.append("files", page.imageBuffer, {
        filename: `page-${page.page || index + 1}.png`,
        contentType: "image/png",
      });
    });

    const response = await fetch(fallbackUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form,
      timeout: 120000,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `LlamaParse failed via SDK and REST (${response.status}): ${body}; sdkError=${sdkError.message}`
      );
    }

    const payload = await response.json();
    const blocks = normalizeLlamaPayload(payload);
    if (!blocks.length) {
      throw new Error("LlamaParse returned no text blocks.");
    }

    return {
      provider: "llamaparse-premium",
      blocks,
      raw: payload,
    };
  }
}

async function extractStructuredOcr(purifiedPages = []) {
  try {
    return await extractWithMistralOcr(purifiedPages);
  } catch (mistralError) {
    const llama = await extractWithLlamaParse(purifiedPages);
    llama.fallbackReason = mistralError.message;
    return llama;
  }
}

module.exports = {
  LLAMA_PARSE_INSTRUCTION,
  extractWithMistralOcr,
  extractWithLlamaParse,
  extractStructuredOcr,
};
