import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const profile = {
  displayName: "Camille Test",
  school: "École fictive",
  degree: "Master",
  company: "Entreprise fictive",
  tutorName: "",
  internshipStart: "2026-09-01",
  internshipEnd: "2027-02-28",
};

async function register(request: APIRequestContext, displayName = profile.displayName) {
  const credentials = { email: `journey-${randomUUID()}@example.test`, password: "Stajio-E2E-Parcours-2026!" };
  await expect(await request.post("/api/auth/register", { data: { ...credentials, displayName } })).toBeOK();
  await expect(await request.post("/api/auth/login", { data: credentials })).toBeOK();
  return credentials;
}

async function configuredStudent(page: Page) {
  const request = page.context().request;
  await register(request);
  await expect(await request.post("/api/onboarding", { data: { profile, deadlines: [] } })).toBeOK();
  return request;
}

const nav = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name, exact: true }).click();

test.describe("Parcours V1", () => {
  test.setTimeout(90_000);

  test("une configuration interrompue reprend, et seules les échéances confirmées sont créées", async ({ page }) => {
    const request = page.context().request;
    await register(request);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Configure ton profil" })).toBeVisible();
    await page.getByLabel("École", { exact: true }).fill(profile.school);
    await expect(page.getByText("Brouillon enregistré")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Ta configuration interrompue a été reprise")).toBeVisible();
    await expect(page.getByLabel("École", { exact: true })).toHaveValue(profile.school);

    await page.getByRole("button", { name: "Continuer vers les échéances" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Diplôme : champ obligatoire." })).toBeVisible();
    await page.getByLabel("Diplôme", { exact: true }).fill(profile.degree);
    await page.getByLabel("Entreprise", { exact: true }).fill(profile.company);
    await page.getByLabel("Début du stage ou de l'alternance").fill(profile.internshipStart);
    await page.getByLabel("Fin du stage ou de l'alternance").fill(profile.internshipEnd);
    await page.getByRole("button", { name: "Continuer vers les échéances" }).click();

    await expect(page.getByLabel("Date de « Point mi-parcours avec le tuteur »")).toHaveValue("2026-11-30");
    await page.getByLabel("Ajouter « Soutenance »").check();
    await page.getByRole("button", { name: "Terminer la configuration" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Soutenance" })).toBeVisible();
    await page.getByLabel("Ajouter « Soutenance »").uncheck();
    await page.getByLabel("Date de « Remise du rapport de stage »").fill("2027-02-10");
    await page.getByRole("button", { name: "Terminer la configuration" }).click();

    await expect(page.getByRole("heading", { name: /Salut, Camille/ })).toBeVisible();
    const deadlines = await (await request.get("/api/deadlines")).json();
    expect(deadlines.map((deadline: { title: string; date: string }) => [deadline.title, deadline.date])).toEqual([
      ["Point mi-parcours avec le tuteur", "2026-11-30"],
      ["Remise du rapport de stage", "2027-02-10"],
    ]);
    const calendar = await request.get("/api/deadlines/calendar");
    expect(calendar.headers()["content-type"]).toContain("text/calendar");
    expect((await calendar.text()).match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  test("sans Ollama, une note datée est enregistrée, son brouillon survit, puis la structuration est relue", async ({
    page,
    browser,
  }) => {
    const request = await configuredStudent(page);
    await page.goto("/");
    await nav(page, "Journal de bord");
    await page.getByRole("button", { name: "Nouvelle note" }).click();
    await page.getByLabel("Date de l'activité").fill("2026-10-05");
    await page.getByLabel("Ce que tu as fait").fill("J'ai écrit les tests de l'API de facturation.");
    await expect(page.getByText("Brouillon enregistré")).toBeVisible();

    await page.reload();
    await nav(page, "Journal de bord");
    await page.getByRole("button", { name: "Nouvelle note" }).click();
    await expect(page.getByText("Ton brouillon non enregistré a été restauré.")).toBeVisible();
    await expect(page.getByLabel("Ce que tu as fait")).toHaveValue("J'ai écrit les tests de l'API de facturation.");

    // Another account never sees this draft.
    const other = await browser.newContext();
    await register(other.request, "Autre étudiant");
    expect((await (await other.request.get("/api/drafts/journal:new")).json()).draft).toBeNull();
    await other.close();

    await page.getByRole("button", { name: "Enregistrer la note" }).click();
    await expect(page.getByText("Note enregistrée.")).toBeVisible();
    await page.reload();
    await nav(page, "Journal de bord");
    await expect(page.getByRole("heading", { name: "05 octobre 2026" })).toBeVisible();

    // Ollama is not running in this environment: the note is untouched.
    await page.getByRole("button", { name: "Structurer avec l'IA" }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Ollama" })).toBeVisible();
    await page.getByRole("button", { name: "Ignorer" }).click();

    await page.route("**/api/ai", (route) =>
      route.fulfill({
        json: {
          result: {
            summary: "Tests de l'API de facturation.",
            missions: ["Écrire les tests"],
            technologies: ["Vitest"],
            skills: ["Tests automatisés"],
          },
          model: "modele-simule",
          generatedAt: new Date().toISOString(),
        },
      }),
    );
    await page.getByRole("button", { name: "Structurer avec l'IA" }).first().click();
    await expect(page.getByLabel("Résumé")).toHaveValue("Tests de l'API de facturation.");
    await page.getByLabel("Résumé").fill("Tests automatisés de l'API de facturation.");
    await page.getByRole("button", { name: "Appliquer la proposition" }).click();
    await expect(page.getByText("Proposition appliquée. Ton texte d'origine est inchangé.")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: "Résumé : Tests automatisés" })).toBeVisible();
    const [note] = await (await request.get("/api/logs")).json();
    expect(note).toMatchObject({
      rawContent: "J'ai écrit les tests de l'API de facturation.",
      summary: "Tests automatisés de l'API de facturation.",
      skills: ["Tests automatisés"],
    });

    await nav(page, "Compétences");
    await page.getByRole("button", { name: /Tests automatisés/ }).click();
    await expect(page.getByRole("heading", { name: "Tests automatisés", exact: true })).toBeVisible();
    await expect(page.getByText("Preuves (1)")).toBeVisible();
  });

  test("un rapport corrigé est repris après rechargement, versionné et exporté", async ({ page }) => {
    const request = await configuredStudent(page);
    await expect(
      await request.post("/api/logs", { data: { date: "2026-10-05", rawContent: "Mise en place de la CI." } }),
    ).toBeOK();
    page.on("dialog", (dialog) => void dialog.accept());
    await page.goto("/");
    await nav(page, "Rapport");
    await page.getByRole("button", { name: "Créer mon rapport" }).click();
    await page.getByLabel("Consignes de l'école (colle-les ici)").fill("Rapport de 20 pages, plan libre.");
    await expect(page.getByText("Notes sources (1 sélectionnée)")).toBeVisible();

    await page.route("**/api/ai/stream", (route) =>
      route.fulfill({
        contentType: "application/x-ndjson",
        body: [
          {
            type: "meta",
            model: "modele-simule",
            generatedAt: new Date().toISOString(),
            instructions: "test",
            sources: [],
          },
          { type: "delta", text: "J'ai rejoint l'équipe [À compléter : date d'arrivée]." },
          { type: "done" },
        ]
          .map((event) => JSON.stringify(event))
          .join("\n"),
      }),
    );
    await page.getByRole("tab", { name: "3. Rédaction" }).click();
    await page.getByRole("button", { name: "Rédiger avec l'IA" }).click();
    await expect(page.getByText("Proposition terminée")).toBeVisible();
    await page.getByRole("button", { name: "Utiliser ce texte" }).click();
    const editor = page.getByLabel("Contenu de la section en Markdown");
    await expect(editor).toHaveValue("J'ai rejoint l'équipe [À compléter : date d'arrivée].");
    await editor.fill("J'ai rejoint l'équipe en septembre 2026.");
    await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();

    await page.reload();
    await nav(page, "Rapport");
    await page.getByRole("tab", { name: "3. Rédaction" }).click();
    await expect(page.getByLabel("Contenu de la section en Markdown")).toHaveValue(
      "J'ai rejoint l'équipe en septembre 2026.",
    );

    await page.getByRole("tab", { name: "4. Relecture et export" }).click();
    await page.getByLabel("Nom de la version").fill("Relue");
    await page.getByRole("button", { name: "Enregistrer une version" }).click();
    await expect(page.getByText("Version enregistrée.")).toBeVisible();

    await page.getByRole("tab", { name: "3. Rédaction" }).click();
    await page.getByLabel("Contenu de la section en Markdown").fill("Texte remplacé par erreur.");
    await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "4. Relecture et export" }).click();
    await page.getByRole("listitem").filter({ hasText: "Relue" }).getByRole("button", { name: "Restaurer" }).click();
    await expect(page.getByText("Version restaurée.")).toBeVisible();

    const pdf = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter en PDF" }).click();
    const pdfFile = await (await pdf).path();
    const pdfText = (await readFile(pdfFile)).toString("latin1");
    // Built-in PDF fonts store "é" as a single Latin-1 byte.
    expect(pdfText).toContain("(J'ai rejoint l'équipe en septembre 2026.) Tj");
    expect(pdfText).toContain("Page 1 /");

    const markdown = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exporter en Markdown" }).click();
    const markdownText = await readFile((await (await markdown).path())!, "utf8");
    expect(markdownText).toContain("J'ai rejoint l'équipe en septembre 2026.");
    expect(markdownText).not.toContain("Texte remplacé par erreur.");
  });
});
