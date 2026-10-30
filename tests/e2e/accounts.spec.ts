import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { BackupDocument } from "../../src/types/backup";

const profile = {
  displayName: "Étudiant sécurité",
  school: "École de test",
  degree: "Master",
  internshipStart: "2026-10-21",
  internshipEnd: "2026-12-31",
  company: "Entreprise de test",
  tutorName: "Tuteur",
};

async function createStudent(request: APIRequestContext) {
  const credentials = { email: `account-${randomUUID()}@example.test`, password: "Stajio-E2E-Initial-2026!" };
  await expect(
    await request.post("/api/auth/register", { data: { ...credentials, displayName: profile.displayName } }),
  ).toBeOK();
  const login = await request.post("/api/auth/login", { data: credentials });
  await expect(login).toBeOK();
  const { user } = await login.json();
  await expect(await request.post("/api/profile", { data: profile })).toBeOK();
  await expect(
    await request.post("/api/logs", {
      data: { id: "account-note", date: "2026-10-27", rawContent: "Note privée de ce compte" },
    }),
  ).toBeOK();
  await expect(
    await request.post("/api/deadlines", {
      data: { id: "account-deadline", date: "2026-12-20", title: "Rendu", type: "school" },
    }),
  ).toBeOK();
  await expect(
    await request.post("/api/ai-outputs", {
      data: { type: "cv", title: "Points CV", content: "- Réalisation personnelle" },
    }),
  ).toBeOK();
  return { ...credentials, user };
}

async function exportedContents(request: APIRequestContext) {
  const response = await request.get("/api/export");
  await expect(response).toBeOK();
  const { profile: savedProfile, logs, deadlines, aiOutputs } = (await response.json()) as BackupDocument;
  return { profile: savedProfile, logs, deadlines, aiOutputs };
}

async function openSecurity(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Mon Profil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sécurité du compte", exact: true })).toBeVisible();
  return page.getByRole("region", { name: "Sécurité du compte", exact: true });
}

test.describe("Sécurité du compte", () => {
  test.setTimeout(60_000);

  test("changer le mot de passe conserve la session courante et révoque les autres", async ({
    page,
    request,
  }, testInfo) => {
    const current = page.context().request;
    const account = await createStudent(current);
    const original = await exportedContents(current);
    await expect(
      await request.post("/api/auth/login", { data: { email: account.email, password: account.password } }),
    ).toBeOK();
    await expect(await request.get("/api/export")).toBeOK();
    const section = await openSecurity(page);
    await section.screenshot({ path: testInfo.outputPath("account-security-desktop.png") });
    const newPassword = "Stajio-E2E-Nouveau-2026!";
    await page.getByLabel("Mot de passe actuel", { exact: true }).fill(account.password);
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirmer le nouveau mot de passe", { exact: true }).fill(newPassword);
    const changed = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/auth/password");
    await page.getByRole("button", { name: "Modifier le mot de passe", exact: true }).click();
    expect((await changed).status()).toBe(200);
    await expect(
      page.getByText("Mot de passe modifié. Les autres sessions ont été déconnectées.", { exact: true }),
    ).toBeVisible();
    expect(await exportedContents(current)).toEqual(original);
    expect((await request.get("/api/export")).status()).toBe(403);
    expect(await (await request.get("/api/auth/me")).json()).toEqual({ user: null });
    expect(
      (await request.post("/api/auth/login", { data: { email: account.email, password: account.password } })).status(),
    ).toBe(401);
    await expect(
      await request.post("/api/auth/login", { data: { email: account.email, password: newPassword } }),
    ).toBeOK();
    expect((await (await request.get("/api/auth/me")).json()).user.uid).toBe(account.user.uid);
    await page.reload();
    await expect(page.getByRole("button", { name: "Mon Profil", exact: true })).toBeVisible();
  });

  test("effacer les données exige confirmation et mot de passe puis conserve le compte", async ({ page }, testInfo) => {
    const current = page.context().request;
    const account = await createStudent(current);
    const original = await exportedContents(current);
    const section = await openSecurity(page);
    await page.getByRole("button", { name: "Effacer mes données", exact: true }).click();
    const submit = page.getByRole("button", { name: "Confirmer l'effacement des données", exact: true });
    await expect(submit).toBeDisabled();
    await section
      .getByRole("form", { name: "Confirmer la suppression", exact: true })
      .screenshot({ path: testInfo.outputPath("clear-data-confirmation.png") });
    await page.getByLabel("Mot de passe pour confirmer", { exact: true }).fill(account.password);
    await page.getByLabel("Saisis SUPPRIMER pour confirmer", { exact: true }).fill("supprimer");
    await expect(submit).toBeDisabled();
    await page.getByRole("button", { name: "Annuler la suppression", exact: true }).click();
    expect(await exportedContents(current)).toEqual(original);

    await page.getByRole("button", { name: "Effacer mes données", exact: true }).click();
    await page.getByLabel("Mot de passe pour confirmer", { exact: true }).fill("Mot-de-passe-incorrect");
    await page.getByLabel("Saisis SUPPRIMER pour confirmer", { exact: true }).fill("SUPPRIMER");
    const denied = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/account");
    await submit.click();
    expect((await denied).status()).toBe(403);
    await expect(section.getByRole("alert")).toContainText("Le mot de passe actuel est incorrect");
    expect(await exportedContents(current)).toEqual(original);

    await page.getByLabel("Mot de passe pour confirmer", { exact: true }).fill(account.password);
    const cleared = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/account");
    await submit.click();
    expect((await cleared).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Configure ton profil", exact: true })).toBeVisible();
    const remaining = await exportedContents(current);
    expect(remaining).toMatchObject({
      profile: { school: null, internshipStart: null, internshipEnd: null },
      logs: [],
      deadlines: [],
      aiOutputs: [],
    });
    const me = await (await current.get("/api/auth/me")).json();
    expect(me.user.uid).toBe(account.user.uid);
    await expect(
      await current.post("/api/auth/login", { data: { email: account.email, password: account.password } }),
    ).toBeOK();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Configure ton profil", exact: true })).toBeVisible();
  });

  test("supprimer le compte retire l'accès et les contenus sans affecter un autre compte", async ({
    page,
    request,
  }) => {
    const current = page.context().request;
    const account = await createStudent(current);
    const originalCookie = (await page.context().cookies()).find((cookie) => cookie.name === "token")!.value;
    const other = await createStudent(request);
    const otherContents = await exportedContents(request);
    await openSecurity(page);
    await page.getByRole("button", { name: "Supprimer mon compte", exact: true }).click();
    const submit = page.getByRole("button", { name: "Confirmer la suppression du compte", exact: true });
    await expect(submit).toBeDisabled();
    await page.getByLabel("Mot de passe pour confirmer", { exact: true }).fill(account.password);
    await page.getByLabel("Saisis SUPPRIMER pour confirmer", { exact: true }).fill("SUPPRIMER");
    const deleted = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/account");
    await submit.click();
    expect((await deleted).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Stajio", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
    expect((await current.get("/api/export")).status()).toBe(401);
    expect((await current.get("/api/export", { headers: { Cookie: `token=${originalCookie}` } })).status()).toBe(403);
    expect(
      (await current.post("/api/auth/login", { data: { email: account.email, password: account.password } })).status(),
    ).toBe(401);
    expect(await exportedContents(request)).toEqual(otherContents);
    expect((await (await request.get("/api/auth/me")).json()).user.uid).toBe(other.user.uid);

    // Reusing the deleted address creates a fresh identity, with no old contents.
    await expect(
      await current.post("/api/auth/register", {
        data: { email: account.email, password: account.password, displayName: "Nouveau compte" },
      }),
    ).toBeOK();
    const recreated = await current.post("/api/auth/login", {
      data: { email: account.email, password: account.password },
    });
    await expect(recreated).toBeOK();
    expect((await recreated.json()).user.uid).not.toBe(account.user.uid);
    expect(await exportedContents(current)).toMatchObject({
      profile: { school: null },
      logs: [],
      deadlines: [],
      aiOutputs: [],
    });
  });
});
