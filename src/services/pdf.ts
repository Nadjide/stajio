import { jsPDF } from "jspdf";

const PAGE_MARGIN = 18;
const LINE_HEIGHT = 5.5;

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "numbered"; index: string; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "spacer" };

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      blocks.push({ kind: "spacer" });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: stripInlineMarkdown(heading[2]),
      });
      continue;
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      blocks.push({ kind: "bullet", text: stripInlineMarkdown(bullet[1]) });
      continue;
    }

    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      blocks.push({ kind: "numbered", index: numbered[1], text: stripInlineMarkdown(numbered[2]) });
      continue;
    }

    blocks.push({ kind: "paragraph", text: stripInlineMarkdown(trimmed) });
  }
  return blocks;
}

/**
 * Exporte un contenu Markdown en PDF texte natif (sélectionnable, net),
 * avec gestion des sauts de page.
 */
export function exportMarkdownToPDF(title: string, markdown: string, filename: string) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - PAGE_MARGIN * 2;
  let y = PAGE_MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - PAGE_MARGIN) {
      pdf.addPage();
      y = PAGE_MARGIN;
    }
  };

  const writeLines = (text: string, indent = 0, prefix = "") => {
    const width = maxWidth - indent;
    const lines: string[] = pdf.splitTextToSize(prefix ? `${prefix}${text}` : text, width);
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      pdf.text(line, PAGE_MARGIN + indent, y);
      y += LINE_HEIGHT;
    }
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  writeLines(title);
  y += 4;

  for (const block of parseMarkdown(markdown)) {
    switch (block.kind) {
      case "heading": {
        const sizes = { 1: 16, 2: 14, 3: 12 } as const;
        y += 3;
        ensureSpace(LINE_HEIGHT * 2);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(sizes[block.level]);
        writeLines(block.text);
        y += 1;
        break;
      }
      case "bullet":
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        writeLines(block.text, 6, "• ");
        break;
      case "numbered":
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        writeLines(block.text, 6, `${block.index}. `);
        break;
      case "paragraph":
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        writeLines(block.text);
        break;
      case "spacer":
        y += 2.5;
        break;
    }
  }

  pdf.save(filename);
}
