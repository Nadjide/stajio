import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const SCREENS = [
  "Tableau de bord",
  "Journal de bord",
  "Compétences",
  "Timeline",
  "Échéances",
  "Rapport",
  "Outils IA",
  "Assistant IA",
  "Comment ça marche",
  "FAQ",
  "Mon Profil",
];

async function audit(page: Page, screen: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  // One readable line per failing element, so a failure says what to fix and where.
  return violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${screen} › ${violation.id} › ${node.target.join(" ")} › ${(node.failureSummary ?? "").replace(/\s+/g, " ")}`,
    ),
  );
}

async function demoStudent(page: Page) {
  const request = page.context().request;
  const credentials = { email: `a11y-${randomUUID()}@example.test`, password: "Stajio-E2E-Accessibilite-2026!" };
  await expect(
    await request.post("/api/auth/register", { data: { ...credentials, displayName: "Camille Démo" } }),
  ).toBeOK();
  await expect(await request.post("/api/auth/login", { data: credentials })).toBeOK();
  const backup = JSON.parse(await readFile("docs/fixtures/demo-backup.json", "utf8"));
  const preview = await request.post("/api/import/preview", { data: { backup } });
  await expect(preview).toBeOK();
  const { backupHash, currentHash } = (await preview.json()).preview;
  await expect(
    await request.post("/api/import", { data: { backup, backupHash, currentHash, confirmation: "REMPLACER" } }),
  ).toBeOK();
}

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function openScreen(page: Page, screen: string) {
  // Below the lg breakpoint the navigation lives in a menu that must be opened first.
  if (isMobile(page)) await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: screen, exact: true })
    .click();
  await page.waitForLoadState("networkidle");
  // Entrance animations fade content in: audit the settled screen, not a half-transparent frame.
  // Looping animations (spinners) never settle and are ignored.
  await expect
    .poll(
      () =>
        page.evaluate(() => [
          ...document
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === "running" && animation.effect?.getComputedTiming().iterations !== Infinity,
            )
            .map((animation) => `animation ${(animation.effect as KeyframeEffect | null)?.target?.className}`),
          ...[...document.querySelectorAll<HTMLElement>("[style*='opacity']")]
            .filter((element) => getComputedStyle(element).opacity !== "1")
            .map((element) => `opacity ${element.outerHTML.slice(0, 160)}`),
        ]),
      { timeout: 10_000 },
    )
    .toEqual([]);
}

async function tabUntilFocused(page: Page, target: Locator, maxPresses: number) {
  for (let presses = 0; presses < maxPresses; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

test.describe("Accessibilité (axe, WCAG 2.2 AA)", () => {
  test.setTimeout(120_000);

  test("l'écran de connexion ne présente aucune violation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Se connecter/ }).first()).toBeVisible();
    expect(await audit(page, "Connexion")).toEqual([]);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`les écrans principaux en thème ${theme === "light" ? "clair" : "sombre"} ne présentent aucune violation`, async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("stajio-theme", value), theme);
      await demoStudent(page);
      await page.goto("/");
      const violations: string[] = [];
      for (const screen of SCREENS) {
        await openScreen(page, screen);
        violations.push(...(await audit(page, screen)));
      }
      expect(violations).toEqual([]);
    });
  }

  test("au clavier, le lien d'évitement et la navigation sont atteignables avec un focus visible", async ({ page }) => {
    await demoStudent(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Salut, Camille/ })).toBeVisible();

    // The development server adds its own indicator first in the tab order.
    const skipLink = page.getByRole("link", { name: "Aller au contenu" });
    await tabUntilFocused(page, skipLink, 3);
    await expect(skipLink).toBeInViewport();

    // The navigation comes right after the skip link, with a visible focus outline.
    const journal = page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("button", { name: "Journal de bord", exact: true });
    await tabUntilFocused(page, journal, 5);
    const outline = await journal.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Nouvelle note" })).toBeVisible();

    // Activating the skip link moves focus past the navigation, into the screen.
    await skipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.querySelector("main")?.contains(document.activeElement))).toBe(true);
  });

  test("sur mobile, le menu fermé est hors du parcours clavier et Échap le referme", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await demoStudent(page);
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Ouvrir le menu" });
    await expect(menuButton).toBeVisible();
    const navigation = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(navigation).toBeHidden();

    await menuButton.click();
    await expect(page.getByRole("button", { name: "Fermer le menu" })).toBeFocused();
    await expect(navigation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(navigation).toBeHidden();
    await expect(menuButton).toBeFocused();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  test("sur mobile, le menu et les écrans restent utilisables sans débordement", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await demoStudent(page);
    await page.goto("/");
    const violations: string[] = [];
    for (const screen of SCREENS) {
      await openScreen(page, screen);
      violations.push(...(await audit(page, `${screen} (mobile)`)));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `débordement horizontal sur ${screen}`).toBeLessThanOrEqual(0);
    }
    expect(violations).toEqual([]);
  });
});
