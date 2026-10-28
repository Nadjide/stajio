import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { BackupDocument } from "../../src/types/backup";

const profile = {
  displayName: "Étudiant initial",
  school: "École initiale",
  degree: "Master",
  internshipStart: "2026-10-21",
  internshipEnd: "2026-12-31",
  company: "Entreprise initiale",
  tutorName: "Tuteur initial",
};

async function createAccount(request: APIRequestContext) {
  const credentials = { email: `backup-${randomUUID()}@example.test`, password: "Stajio-E2E-Password-2026!" };
  const registered = await request.post("/api/auth/register", {
    data: { ...credentials, displayName: profile.displayName },
  });
  await expect(registered).toBeOK();
  const loggedIn = await request.post("/api/auth/login", { data: credentials });
  await expect(loggedIn).toBeOK();
  return { ...credentials, user: (await loggedIn.json()).user };
}

async function exportBackup(request: APIRequestContext): Promise<BackupDocument> {
  const response = await request.get("/api/export");
  await expect(response).toBeOK();
  const backup = await response.json();
  expect(backup.version).toBe(3);
  return backup;
}

function contents({ profile: savedProfile, logs, deadlines, aiOutputs }: BackupDocument) {
  return { profile: savedProfile, logs, deadlines, aiOutputs };
}

async function setupStudent(page: Page) {
  const request = page.context().request;
  const account = await createAccount(request);
  await expect(await request.post("/api/profile", { data: profile })).toBeOK();
  await expect(
    await request.post("/api/logs", {
      data: {
        id: "saved-note",
        date: "2026-10-27",
        rawContent: "Note initiale",
        structuredContent: "Résumé initial",
        summary: "Résumé initial",
        skills: ["React"],
        missions: ["Mission"],
        technologies: ["TypeScript"],
      },
    }),
  ).toBeOK();
  await expect(
    await request.post("/api/deadlines", {
      data: { id: "saved-deadline", title: "Échéance initiale", date: "2026-12-20", type: "school", completed: false },
    }),
  ).toBeOK();
  await expect(
    await request.post("/api/ai-outputs", {
      data: { type: "report", title: "Rapport initial", content: "# Brouillon initial" },
    }),
  ).toBeOK();
  await page.goto("/");
  await page.getByRole("button", { name: "Mon Profil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mon Profil", exact: true })).toBeVisible();
  return { request, account, original: await exportBackup(request) };
}

function changedBackup(original: BackupDocument): BackupDocument {
  const backup = structuredClone(original);
  backup.profile.displayName = "Profil restauré";
  backup.profile.company = "Entreprise restaurée";
  backup.profile.school = "École restaurée";
  backup.logs[0].rawContent = "Texte restauré";
  backup.logs[0].summary = "Résumé restauré";
  backup.logs[0].structuredContent = "Résumé restauré";
  backup.deadlines[0].title = "Échéance restaurée";
  backup.aiOutputs[0].content = "# Rapport restauré";
  return backup;
}

async function chooseBackup(page: Page, backup: unknown) {
  const response = page.waitForResponse((result) => new URL(result.url()).pathname === "/api/import/preview");
  await page.getByLabel("Choisir une sauvegarde JSON", { exact: true }).setInputFiles({
    name: "sauvegarde-stajio.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  const preview = await response;
  expect(preview.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Restaurer une sauvegarde", exact: true })).toBeVisible();
}

async function confirmRestore(page: Page) {
  await page
    .getByRole("checkbox", { name: "Je confirme le remplacement des données de ce compte.", exact: true })
    .check();
  const response = page.waitForResponse((result) => new URL(result.url()).pathname === "/api/import");
  await page.getByRole("button", { name: "Restaurer les données", exact: true }).click();
  return response;
}

test.describe("Sauvegarde et restauration du compte", () => {
  test.setTimeout(60_000);

  test("l'aperçu et l'annulation conservent les données sans confirmation", async ({ page }, testInfo) => {
    const { request, original } = await setupStudent(page);
    await chooseBackup(page, changedBackup(original));
    await expect(page.getByRole("button", { name: "Restaurer les données", exact: true })).toBeDisabled();
    expect(contents(await exportBackup(request))).toEqual(contents(original));
    await page
      .locator('[aria-labelledby="restore-title"]')
      .screenshot({ path: testInfo.outputPath("restore-preview-desktop.png"), animations: "disabled" });
    await page.setViewportSize({ width: 360, height: 900 });
    await expect
      .poll(async () => {
        const sidebar = await page.locator("aside").boundingBox();
        return sidebar ? sidebar.x + sidebar.width : 0;
      })
      .toBeLessThanOrEqual(0);
    const tableSize = await page
      .getByRole("table", { name: "Données actuelles et données de la sauvegarde", exact: true })
      .evaluate((table) => ({
        clientWidth: table.parentElement!.clientWidth,
        scrollWidth: table.parentElement!.scrollWidth,
      }));
    expect(tableSize.scrollWidth).toBeLessThanOrEqual(tableSize.clientWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath("restore-mobile-full-page.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Restaurer une sauvegarde", exact: true })).toBeHidden();
    expect(contents(await exportBackup(request))).toEqual(contents(original));
  });

  test("restaure le profil et les collections puis réimporte sans doublons", async ({ page }) => {
    const { request, original, account } = await setupStudent(page);
    const backup = changedBackup(original);
    await expect(
      await request.post("/api/logs", { data: { date: "2026-10-28", rawContent: "Note à remplacer" } }),
    ).toBeOK();
    await chooseBackup(page, backup);
    expect((await confirmRestore(page)).status()).toBe(200);
    await expect(
      page.getByText("Sauvegarde restaurée. Les données du compte ont été remplacées.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Profil restauré", { exact: true })).toBeVisible();
    await expect(page.getByText("Entreprise restaurée", { exact: true })).toBeVisible();
    expect(contents(await exportBackup(request))).toEqual(contents(backup));
    const currentUser = await (await request.get("/api/auth/me")).json();
    expect(currentUser.user.email).toBe(account.email);
    expect(currentUser.user.uid).toBe(account.user.uid);

    await chooseBackup(page, backup);
    expect((await confirmRestore(page)).status()).toBe(200);
    expect(contents(await exportBackup(request))).toEqual(contents(backup));
  });

  test("refuse un aperçu périmé et exige une nouvelle confirmation après actualisation", async ({ page }) => {
    const { request, original } = await setupStudent(page);
    const backup = changedBackup(original);
    await chooseBackup(page, backup);
    await expect(
      await request.post("/api/logs", {
        data: { date: "2026-10-28", rawContent: "Note ajoutée dans un autre onglet" },
      }),
    ).toBeOK();
    expect((await confirmRestore(page)).status()).toBe(409);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Tes données ont changé depuis l'aperçu");
    await expect(
      page.getByRole("checkbox", { name: "Je confirme le remplacement des données de ce compte.", exact: true }),
    ).not.toBeChecked();
    expect((await exportBackup(request)).logs).toHaveLength(2);

    const refresh = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/import/preview");
    await page.getByRole("button", { name: "Actualiser l'aperçu", exact: true }).click();
    expect((await refresh).status()).toBe(200);
    await expect(page.getByRole("button", { name: "Restaurer les données", exact: true })).toBeDisabled();
    expect((await confirmRestore(page)).status()).toBe(200);
    expect(contents(await exportBackup(request))).toEqual(contents(backup));
  });

  test("rejette les fichiers invalides sans modifier le compte", async ({ page }) => {
    const { request, original } = await setupStudent(page);
    await page.getByLabel("Choisir une sauvegarde JSON", { exact: true }).setInputFiles({
      name: "invalide.json",
      mimeType: "application/json",
      buffer: Buffer.from("ceci n'est pas du JSON"),
    });
    await expect(page.getByRole("main").getByRole("alert")).toContainText("document JSON valide");
    expect(contents(await exportBackup(request))).toEqual(contents(original));

    const rejected = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/import/preview");
    await page.getByLabel("Choisir une sauvegarde JSON", { exact: true }).setInputFiles({
      name: "version-incompatible.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 999 })),
    });
    expect((await rejected).status()).toBe(400);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Version de sauvegarde absente ou incompatible",
    );
    await expect(page.getByRole("heading", { name: "Restaurer une sauvegarde", exact: true })).toBeHidden();
    expect(contents(await exportBackup(request))).toEqual(contents(original));
  });

  test("une sauvegarde avant configuration revient au profil à compléter", async ({ page, request }) => {
    await createAccount(request);
    const unconfigured = await exportBackup(request);
    expect(unconfigured.profile.school).toBeNull();
    const current = await setupStudent(page);
    await chooseBackup(page, unconfigured);
    expect((await confirmRestore(page)).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Configure ton profil", exact: true })).toBeVisible();
    expect(contents(await exportBackup(current.request))).toEqual(contents(unconfigured));
    const currentUser = await (await current.request.get("/api/auth/me")).json();
    expect(currentUser.user.email).toBe(current.account.email);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Configure ton profil", exact: true })).toBeVisible();
  });
});
