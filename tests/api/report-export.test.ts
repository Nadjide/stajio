import { describe, expect, it } from "vitest";
import { buildMarkdownPdf, parseMarkdown, toPdfText } from "../../src/services/pdf";
import { assembleReportMarkdown, missingBriefInformation, reportToComplete } from "../../src/utils/report";
import { countToComplete } from "../../src/utils/ai-budget";
import { getInternshipMidpoint, getInternshipWeekLabel, getPeriodPosition } from "../../src/utils/internship";
import { skillSuggestions } from "../../src/utils/skills";

const pdfText = (markdown: string, options = {}) =>
  Buffer.from(buildMarkdownPdf(markdown, options).output("arraybuffer")).toString("latin1");

describe("PDF export", () => {
  it("keeps French text in a single-byte encoding the built-in fonts can render", () => {
    expect(toPdfText("L’équipe a dû « tout » refaire… — œuvre à 10 €")).toBe(
      "L'équipe a dû « tout » refaire... - oeuvre à 10 EUR",
    );
    const output = pdfText("Mise en production de l’API");
    expect(output).toContain("(Mise en production de l'API) Tj");
    // A two-byte string would show up as NUL-separated characters.
    expect(output).not.toContain("\u0000M");
  });

  it("adds a title page, starts sections on new pages and numbers the following pages", () => {
    const section = (title: string) => `# ${title}\n\n${"Un paragraphe de rapport assez long. ".repeat(40)}`;
    const pdf = buildMarkdownPdf([section("Introduction"), section("Missions"), section("Conclusion")].join("\n\n"), {
      breakOnH1: true,
      titlePage: { title: "Rapport de stage", subtitle: "Entreprise", lines: ["Camille", "Master"] },
    });
    expect(pdf.getNumberOfPages()).toBe(4);
    const output = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
    expect(output).toContain("(Rapport de stage) Tj");
    expect(output).toContain("(Page 1 / 3) Tj");
    expect(output).toContain("(Page 3 / 3) Tj");
  });

  it("paginates a long document", () => {
    const pdf = buildMarkdownPdf(Array.from({ length: 400 }, (_, i) => `- Point numéro ${i + 1}`).join("\n"), {
      title: "Long",
    });
    expect(pdf.getNumberOfPages()).toBeGreaterThan(5);
  });

  it("parses headings, nested lists, quotes, code and joined paragraphs", () => {
    expect(
      parseMarkdown("## Titre **gras**\nune ligne\nsuite\n\n- un\n  - deux\n1. trois\n> cité\n```\ncode\n```\n---"),
    ).toEqual([
      { kind: "heading", level: 2, text: "Titre gras" },
      { kind: "paragraph", text: "une ligne suite" },
      { kind: "bullet", depth: 0, text: "un" },
      { kind: "bullet", depth: 1, text: "deux" },
      { kind: "numbered", depth: 0, index: "1", text: "trois" },
      { kind: "quote", text: "cité" },
      { kind: "code", lines: ["code"] },
      { kind: "rule" },
    ]);
  });
});

describe("Report helpers", () => {
  const section = (title: string, content: string) => ({
    id: title,
    title,
    intent: "",
    content,
    generatedAt: null,
    model: null,
  });

  it("assembles the corrected sections in order and counts passages to complete", () => {
    const report = {
      title: "Rapport",
      sections: [
        section("Intro", "Texte [À compléter : chiffre]"),
        section("Bilan", "[À compléter: date] et [à compléter : nom]"),
      ],
    };
    expect(assembleReportMarkdown(report)).toBe(
      "# Intro\n\nTexte [À compléter : chiffre]\n\n# Bilan\n\n[À compléter: date] et [à compléter : nom]\n",
    );
    expect(reportToComplete(report)).toBe(3);
    expect(countToComplete("Rien à signaler")).toBe(0);
  });

  it("lists what the brief is missing before a generation", () => {
    expect(
      missingBriefInformation({
        guidelines: "",
        problem: "Q",
        targetLength: "",
        periodStart: "2026-02-01",
        periodEnd: "2026-01-01",
        sourceLogIds: [],
      }),
    ).toEqual([
      "Les consignes de l'école ne sont pas renseignées.",
      "La longueur attendue n'est pas précisée.",
      "Aucune note du journal n'est sélectionnée.",
      "La fin de la période précède son début.",
    ]);
  });
});

describe("Internship rules", () => {
  it("computes the real midpoint and classifies dates outside the period", () => {
    expect(getInternshipMidpoint("2026-09-01", "2027-02-28")).toBe("2026-11-30");
    expect(getPeriodPosition("2026-08-31", "2026-09-01", "2027-02-28")).toBe("before");
    expect(getPeriodPosition("2027-03-01", "2026-09-01", "2027-02-28")).toBe("after");
    expect(getInternshipWeekLabel(30, 26)).toBe("Après le stage (semaine 30)");
  });

  it("suggests AI-extracted skills the student has not adopted yet, with their notes", () => {
    const log = (id: string, skills: string[]) => ({
      id,
      uid: "u",
      date: "2026-10-01",
      rawContent: "x",
      structuredContent: "",
      weekNumber: 1,
      skills,
    });
    const suggestions = skillSuggestions(
      [log("a", ["Tests", "React"]), log("b", ["tests", "SQL"])],
      [{ id: "s", label: "react", goal: "", level: "to_work", logIds: [], createdAt: "", updatedAt: "" }],
    );
    expect(suggestions).toEqual([
      { label: "Tests", logIds: ["a", "b"] },
      { label: "SQL", logIds: ["b"] },
    ]);
  });
});
