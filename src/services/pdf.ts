import { jsPDF } from "jspdf";

const PAGE_MARGIN = 20;
const FOOTER_SPACE = 12;
const BODY_SIZE = 11;
const LINE_HEIGHT = 5.6;

type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "bullet"; depth: number; text: string }
  | { kind: "numbered"; depth: number; index: string; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "code"; lines: string[] }
  | { kind: "rule" };

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u201a\u2032]/g, "'"],
  [/[\u201c\u201d\u201e\u2033]/g, '"'],
  [/\u2026/g, "..."],
  [/[\u2010-\u2015\u2212]/g, "-"],
  [/[\u2022\u2023\u25e6\u25aa\u25cf\u2043]/g, "-"],
  [/\u0153/g, "oe"],
  [/\u0152/g, "OE"],
  [/\u20ac/g, "EUR"],
  [/\u2122/g, "(TM)"],
  [/[\u2000-\u200b\u202f\u205f]/g, " "],
  [/\u2264/g, "<="],
  [/\u2265/g, ">="],
  [/[\u2192\u21d2]/g, "->"],
  [/[\u2713\u2714]/g, "v"],
];

/**
 * jsPDF's built-in fonts only render Latin-1. A single character outside it
 * (a typographic apostrophe, for instance) switches the whole line to an
 * unreadable two-byte encoding, so the text is normalized first.
 */
export function toPdfText(text: string): string {
  let value = text.normalize("NFC");
  for (const [pattern, replacement] of REPLACEMENTS) value = value.replace(pattern, replacement);
  return Array.from(value)
    .map((character) => {
      if (character.charCodeAt(0) <= 0xff) return character;
      const base = character.normalize("NFD").replace(/\p{M}/gu, "");
      return base.length === 1 && base.charCodeAt(0) <= 0xff ? base : "?";
    })
    .join("");
}

function stripInlineMarkdown(text: string): string {
  return toPdfText(
    text
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
      .replace(/`([^`]+)`/g, "$1"),
  );
}

/** Small Markdown subset produced by the editor and the model: headings, lists, quotes, code, paragraphs. */
export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let code: string[] | null = null;
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: stripInlineMarkdown(paragraph.join(" ")) });
    paragraph = [];
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (code) {
      if (/^\s*```/.test(rawLine)) {
        blocks.push({ kind: "code", lines: code.map(toPdfText) });
        code = null;
      } else {
        code.push(rawLine.replace(/\t/g, "  "));
      }
      continue;
    }
    const line = rawLine.replace(/\t/g, "  ").trimEnd();
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      flush();
      code = [];
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4,
        text: stripInlineMarkdown(heading[2]),
      });
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }
    const depth = Math.min(Math.floor((line.length - line.trimStart().length) / 2), 3);
    const bullet = /^[-*+•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flush();
      blocks.push({ kind: "bullet", depth, text: stripInlineMarkdown(bullet[1]) });
      continue;
    }
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      flush();
      blocks.push({ kind: "numbered", depth, index: numbered[1], text: stripInlineMarkdown(numbered[2]) });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flush();
      blocks.push({ kind: "quote", text: stripInlineMarkdown(quote[1]) });
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  if (code) blocks.push({ kind: "code", lines: code.map(toPdfText) });
  return blocks;
}

export type TitlePage = { title: string; subtitle?: string; lines: string[] };

/**
 * Native-text PDF: optional title page, top-level headings on new pages,
 * headings kept with their first lines, and "page x / n" footers.
 */
export function buildMarkdownPdf(
  markdown: string,
  options: { title?: string; titlePage?: TitlePage; breakOnH1?: boolean },
) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - PAGE_MARGIN * 2;
  const bottom = pageHeight - PAGE_MARGIN - FOOTER_SPACE;
  let y = PAGE_MARGIN;
  let pageHasContent = false;

  const newPage = () => {
    pdf.addPage();
    y = PAGE_MARGIN;
    pageHasContent = false;
  };
  const ensureSpace = (needed: number) => {
    if (y + needed > bottom) newPage();
  };
  const write = (
    text: string,
    { indent = 0, size = BODY_SIZE, style = "normal", font = "helvetica", height = LINE_HEIGHT } = {},
  ) => {
    pdf.setFont(font, style);
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      ensureSpace(height);
      pdf.text(line, PAGE_MARGIN + indent, y);
      y += height;
      pageHasContent = true;
    }
    return lines.length;
  };

  if (options.titlePage) {
    const { title, subtitle, lines } = options.titlePage;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(26);
    const titleLines: string[] = pdf.splitTextToSize(toPdfText(title), maxWidth);
    let titleY = pageHeight / 3;
    for (const line of titleLines) {
      pdf.text(line, pageWidth / 2, titleY, { align: "center" });
      titleY += 11;
    }
    if (subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(14);
      pdf.text(toPdfText(subtitle), pageWidth / 2, titleY + 4, { align: "center" });
      titleY += 12;
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(12);
    titleY += 20;
    for (const line of lines.filter(Boolean)) {
      pdf.text(toPdfText(line), pageWidth / 2, titleY, { align: "center" });
      titleY += 7;
    }
    newPage();
  } else if (options.title) {
    write(toPdfText(options.title), { size: 18, style: "bold", height: 8 });
    y += 4;
  }

  const headingSizes = { 1: 18, 2: 15, 3: 13, 4: 12 } as const;
  for (const block of parseMarkdown(markdown)) {
    switch (block.kind) {
      case "heading": {
        if (block.level === 1 && options.breakOnH1 && pageHasContent) newPage();
        const height = headingSizes[block.level] * 0.5;
        y += pageHasContent ? 4 : 0;
        // Keep the heading with at least three lines of what follows.
        ensureSpace(height * 2 + LINE_HEIGHT * 3);
        write(block.text, { size: headingSizes[block.level], style: "bold", height });
        y += 2;
        break;
      }
      case "bullet":
        write(`-  ${block.text}`, { indent: 5 + block.depth * 6 });
        y += 0.8;
        break;
      case "numbered":
        write(`${block.index}.  ${block.text}`, { indent: 5 + block.depth * 6 });
        y += 0.8;
        break;
      case "quote":
        write(block.text, { indent: 8, style: "italic" });
        y += 2;
        break;
      case "code":
        for (const line of block.lines) write(line || " ", { indent: 4, size: 9.5, font: "courier", height: 4.6 });
        y += 2;
        break;
      case "rule":
        ensureSpace(6);
        pdf.setDrawColor(180);
        pdf.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
        y += 6;
        break;
      case "paragraph":
        write(block.text);
        y += 2.5;
        break;
    }
  }

  const pages = pdf.getNumberOfPages();
  const first = options.titlePage ? 2 : 1;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  for (let page = first; page <= pages; page++) {
    pdf.setPage(page);
    pdf.text(`Page ${page - first + 1} / ${pages - first + 1}`, pageWidth / 2, pageHeight - PAGE_MARGIN / 2, {
      align: "center",
    });
  }
  pdf.setTextColor(0);
  return pdf;
}

export function exportMarkdownToPDF(title: string, markdown: string, filename: string) {
  buildMarkdownPdf(markdown, { title }).save(filename);
}

export function downloadTextFile(content: string, filename: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
