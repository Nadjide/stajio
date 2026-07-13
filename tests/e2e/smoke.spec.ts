import { expect, test } from "@playwright/test";

test.describe("Parcours principal", () => {
  test("la page d'authentification s'affiche", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Stajio" })).toBeVisible();
    await expect(page.getByPlaceholder("jean@exemple.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("inscription puis arrivée sur la configuration du profil", async ({ page }) => {
    const email = `e2e-${Date.now()}@stajio.dev`;

    await page.goto("/");
    await page.getByRole("button", { name: "Pas encore de compte ? S'inscrire" }).click();

    await page.getByPlaceholder("Jean Dupont").fill("Testeur E2E");
    await page.getByPlaceholder("jean@exemple.com").fill(email);
    await page.getByPlaceholder("••••••••").fill("MotDePasse123!");
    await page.getByRole("button", { name: "Créer un compte" }).click();

    // Après inscription + connexion auto, l'écran de configuration du profil s'affiche
    await expect(page.getByPlaceholder("jean@exemple.com")).toBeHidden({ timeout: 15_000 });
  });
});
