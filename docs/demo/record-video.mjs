// Records docs/demo/stajio-demo.mp4 and stajio-demo.gif: drives a running Stajio production instance with the
// fictional dataset (docs/fixtures/demo-backup.json), captures Chrome screencast frames and encodes them with ffmpeg.
// See docs/demo/README.md. Usage: node docs/demo/record-video.mjs [baseUrl]
import { spawnSync } from "node:child_process";
import { copyFileSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://127.0.0.1:3201";
const projectDir = path.resolve(import.meta.dirname, "../..");
const outDir = mkdtempSync(path.join(os.tmpdir(), "stajio-demo-"));
const framesDir = path.join(outDir, "frames");
mkdirSync(framesDir);

// ---------------------------------------------------------------- overlays injected in every page
function overlays() {
  try {
    if (!localStorage.getItem("stajio-theme")) localStorage.setItem("stajio-theme", "light");
  } catch {
    // Storage unavailable: the app falls back to its default theme.
  }
  const css = `
#demo-cursor{position:fixed;left:0;top:0;width:28px;height:28px;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px)}
#demo-cursor svg{display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
#demo-ring{position:fixed;left:0;top:0;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:999px;border:3px solid rgba(4,120,87,.9);z-index:2147483646;pointer-events:none;opacity:0}
#demo-ring.on{animation:demo-ring .5s ease-out}
@keyframes demo-ring{0%{opacity:1;scale:.35}100%{opacity:0;scale:1.35}}
body{padding-bottom:72px}
.fixed.bottom-4{bottom:calc(72px + 1rem)!important}
#demo-band{position:fixed;left:0;right:0;bottom:0;height:72px;display:flex;align-items:center;justify-content:center;background:#1c1917;border-top:3px solid #047857;z-index:2147483640;pointer-events:none}
#demo-caption{max-width:1200px;padding:0 28px;color:#fff;font:600 19px/1.35 "Segoe UI",Inter,system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .3s ease}
#demo-caption.on{opacity:1}
#demo-caption small{display:block;margin-top:2px;font-weight:500;font-size:14px;color:#a8a29e}
#demo-card{position:fixed;inset:0;z-index:2147483645;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(circle at 50% 35%,#ecfdf5 0,#fafaf9 55%,#f5f5f4 100%);color:#1c1917;font-family:"Segoe UI",Inter,system-ui,sans-serif;text-align:center;opacity:1;transition:opacity .7s ease}
#demo-card.off{opacity:0}
#demo-card h1{margin:0;font-size:72px;font-weight:800;letter-spacing:-.02em}
#demo-card p{margin:0;font-size:26px;color:#44403c;max-width:900px;line-height:1.4}
#demo-card .chips{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px}
#demo-card .chips span{padding:6px 14px;border-radius:999px;background:#fff;border:1px solid #d6d3d1;font-size:17px;font-weight:600;color:#047857}
#demo-card .small{font-size:18px;color:#57534e}
`;
  const mount = () => {
    if (document.getElementById("demo-style")) return;
    const style = document.createElement("style");
    style.id = "demo-style";
    style.textContent = css;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2.5v17.2l4.6-4.3 2.9 6.6 2.7-1.2-2.9-6.5h6.3z" fill="#fff" stroke="#1c1917" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    const ring = document.createElement("div");
    ring.id = "demo-ring";
    const band = document.createElement("div");
    band.id = "demo-band";
    const caption = document.createElement("div");
    caption.id = "demo-caption";
    band.append(caption);
    document.body.append(cursor, ring, band);
    window.addEventListener(
      "mousemove",
      (event) => (cursor.style.transform = `translate(${event.clientX - 4}px, ${event.clientY - 2}px)`),
      true,
    );
    window.addEventListener(
      "mousedown",
      (event) => {
        ring.style.left = `${event.clientX}px`;
        ring.style.top = `${event.clientY}px`;
        ring.classList.remove("on");
        void ring.offsetWidth;
        ring.classList.add("on");
      },
      true,
    );
  };
  window.__demo = {
    caption(text, sub) {
      mount();
      const element = document.getElementById("demo-caption");
      element.classList.remove("on");
      setTimeout(
        () => {
          element.innerHTML = "";
          element.append(document.createTextNode(text));
          if (sub) {
            const small = document.createElement("small");
            small.textContent = sub;
            element.append(small);
          }
          element.classList.add("on");
        },
        element.textContent ? 280 : 0,
      );
    },
    hideCaption() {
      document.getElementById("demo-caption")?.classList.remove("on");
    },
    card(html) {
      mount();
      const card = document.createElement("div");
      card.id = "demo-card";
      card.innerHTML = html;
      document.body.appendChild(card);
    },
    hideCard() {
      const card = document.getElementById("demo-card");
      card?.classList.add("off");
      setTimeout(() => card?.remove(), 800);
    },
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
}

const TITLE_CARD = `
<img src="/logo.svg" alt="" width="112" height="112" />
<h1>Stajio</h1>
<p>Ton stage ou ton alternance : journal de bord, compétences, rapport et soutenance.<br />Avec une IA locale, et des données qui restent sur ta machine.</p>
<div class="chips"><span>Local-first</span><span>Ollama</span><span>Next.js 16</span><span>SQLite</span></div>
<p class="small">Démonstration avec un jeu de données fictif</p>`;

const END_CARD = `
<img src="/logo.svg" alt="" width="96" height="96" />
<h1>Stajio</h1>
<p>Tes notes deviennent des preuves de compétences et des livrables adaptés à ton école.</p>
<div class="chips"><span>Next.js 16 · React 19</span><span>SQLite</span><span>Ollama</span><span>Docker</span><span>Licence MIT</span></div>
<p class="small">github.com/Nadjide/stajio</p>`;

// ---------------------------------------------------------------- browser and recording
const browser = await chromium.launch({ channel: "chromium", args: ["--lang=fr-FR"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
  locale: "fr-FR",
  timezoneId: "Europe/Paris",
  acceptDownloads: true,
});
await context.addInitScript(overlays);
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.on("dialog", (dialog) => void dialog.accept());
const wait = (ms) => page.waitForTimeout(ms);

let frameCount = 0;
const frames = [];
const marks = [];
let cdp;
async function startRecording() {
  cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    const file = `f${String(frameCount++).padStart(5, "0")}.jpg`;
    writeFileSync(path.join(framesDir, file), Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: 1920, maxHeight: 1080 });
}
const mark = (name) => marks.push({ name, t: Date.now() / 1000 });

const caption = (text, sub) => page.evaluate(([t, s]) => window.__demo.caption(t, s), [text, sub]);
async function moveTo(locator) {
  await locator.waitFor();
  // Keep the target above the caption band, scrolling its own container when needed.
  const scrolled = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.top >= 8 && rect.bottom <= window.innerHeight - 72 - 12) return false;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    return true;
  });
  if (scrolled) await wait(650);
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
  await wait(120);
}
async function click(locator) {
  await moveTo(locator);
  await locator.click();
  await wait(250);
}
async function typeInto(locator, text, delay = 26) {
  await click(locator);
  await page.keyboard.type(text, { delay });
}
const scrollMain = (top) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), top);
async function nav(name) {
  if (await page.evaluate(() => window.scrollY > 0)) {
    await scrollMain(0);
    await wait(600);
  }
  await click(
    page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name, exact: true }),
  );
  await wait(300);
}

// ---------------------------------------------------------------- fictional student
const api = context.request;
const ok = async (response) => {
  if (!response.ok()) throw new Error(`${response.url()} ${response.status()} ${await response.text()}`);
  return response.json();
};
// Test account on the scratch database only; the import below resets its data on every run.
const credentials = { email: "camille@exemple.test", password: "Demo-Stajio-Video-2026!" };
await api.post(`${base}/api/auth/register`, { data: { ...credentials, displayName: "Camille Exemple" } });
await ok(await api.post(`${base}/api/auth/login`, { data: credentials }));
const backup = JSON.parse(readFileSync(path.join(projectDir, "docs/fixtures/demo-backup.json"), "utf8"));
// The note of 22 October is written live in the video, with the exact text of the reference run.
const liveNote = backup.logs.find((log) => log.id === "demo-note-06");
backup.logs = backup.logs.filter((log) => log.id !== liveNote.id);
backup.skillEvidence = backup.skillEvidence.filter((evidence) => evidence.logId !== liveNote.id);
const { preview } = await ok(await api.post(`${base}/api/import/preview`, { data: { backup } }));
await ok(
  await api.post(`${base}/api/import`, {
    data: { backup, backupHash: preview.backupHash, currentHash: preview.currentHash, confirmation: "REMPLACER" },
  }),
);
await ok(await api.post(`${base}/api/auth/logout`));

// ---------------------------------------------------------------- scenario
await page.goto(base);
await page.getByRole("button", { name: "Se connecter", exact: true }).waitFor();
await page.evaluate((html) => window.__demo.card(html), TITLE_CARD);
await wait(600);
await startRecording();
mark("title");
await wait(4200);
await page.evaluate(() => window.__demo.hideCard());
await page.mouse.move(900, 520);
await wait(700);

mark("login");
await caption("Un compte local : les données restent sur ta machine, sans service cloud.");
await typeInto(page.locator("#auth-email"), credentials.email, 30);
await typeInto(page.locator("#auth-password"), credentials.password, 18);
await click(page.getByRole("button", { name: "Se connecter", exact: true }));
await page.getByRole("heading", { name: /Salut, Camille/ }).waitFor();

mark("dashboard");
await caption("Le tableau de bord : échéances proches, semaine en cours et compétences suivies.");
await wait(3200);
await scrollMain(420);
await wait(2600);
await scrollMain(0);
await wait(900);

mark("journal");
await nav("Journal de bord");
await caption("Le journal de bord : une note datée par activité, enregistrée même sans IA.");
await wait(1200);
await click(page.getByRole("button", { name: "Nouvelle note" }));
await moveTo(page.getByLabel("Date de l'activité"));
await page.getByLabel("Date de l'activité").fill(liveNote.date);
await typeInto(page.getByLabel("Ce que tu as fait"), liveNote.rawContent, 24);
await wait(500);
await click(page.getByRole("button", { name: "Enregistrer la note" }));
await page.getByText("Note enregistrée.").waitFor();
await wait(1200);
await typeInto(page.locator("#journal-search"), "plan d'exécution", 40);
await wait(1200);

mark("structure");
await caption(
  "L'IA locale propose un résumé, des missions, des technologies et des compétences.",
  "Sortie réelle de phi4-mini enregistrée pendant la recette, rejouée en accéléré (10 à 45 s en vrai sur processeur).",
);
await click(page.getByRole("button", { name: "Structurer avec l'IA" }).first());
await page.getByLabel("Résumé", { exact: true }).waitFor();
await wait(3200);
await caption("Tu relis et tu corriges : « plan d'exécution » n'est pas une technologie.");
const technologies = page.getByLabel("Technologies (séparées par des virgules)");
await moveTo(technologies);
await technologies.click({ clickCount: 3 });
await page.keyboard.type("PostgreSQL", { delay: 45 });
await wait(900);
await click(page.getByRole("button", { name: "Appliquer la proposition" }));
await page.getByText("Proposition appliquée. Ton texte d'origine est inchangé.").waitFor();
await caption("Proposition appliquée : le texte d'origine de la note reste intact.");
await wait(2200);
const skillSelect = page.getByLabel("Associer une compétence à cette note");
await moveTo(skillSelect);
await skillSelect.selectOption({ label: "Tests automatisés" });
await wait(500);
await click(page.getByRole("button", { name: "Associer", exact: true }));
await caption("La note devient une preuve de la compétence « Tests automatisés ».");
await wait(2400);

mark("skills");
await nav("Compétences");
await caption("Chaque compétence a un objectif, un niveau déclaré et ses preuves tirées du journal.");
await wait(1800);
const skillCard = page.getByRole("article", { name: "Tests automatisés" });
await skillCard.evaluate((element) => element.scrollIntoView({ behavior: "smooth", block: "center" }));
await wait(1300);
await moveTo(skillCard.getByRole("heading", { name: /Preuves/ }));
await wait(3400);

mark("timeline");
await nav("Timeline");
await caption("La timeline résume le stage semaine par semaine.");
await wait(2200);
await scrollMain(500);
await wait(2000);

mark("deadlines");
await nav("Échéances");
await caption("Les échéances s'affichent à l'ouverture et s'exportent vers ton agenda.");
await wait(1200);
await moveTo(page.getByRole("link", { name: /Exporter vers mon calendrier/ }));
await wait(2400);

mark("report");
await nav("Rapport");
await caption("Le rapport part des consignes de l'école, de ta problématique et des notes choisies.");
await click(page.getByRole("button", { name: "Créer mon rapport" }));
await typeInto(
  page.locator("#brief-guidelines"),
  "20 à 25 pages, plan libre, une partie sur les missions réalisées.",
  18,
);
await typeInto(page.locator("#brief-problem"), "Comment fiabiliser l'historique des réservations ?", 22);
await typeInto(page.locator("#brief-length"), "20 à 25 pages", 30);
await page.getByText("Enregistré", { exact: true }).waitFor();
await wait(1000);
await caption("Plan modifiable, ou proposé par l'IA, puis rédaction section par section.");
await click(page.getByRole("tab", { name: "2. Plan" }));
await wait(2600);
await click(page.getByRole("tab", { name: "3. Rédaction" }));
await click(
  page.getByRole("navigation", { name: "Sections du rapport" }).getByRole("button", { name: /Missions réalisées/ }),
);
await wait(800);

mark("section");
await caption(
  "phi4-mini rédige la section « Missions réalisées » à partir des notes du journal.",
  "Sortie réelle rejouée en accéléré : 2 à 3 minutes en vrai sur un portable sans carte graphique.",
);
await click(page.getByRole("button", { name: "Rédiger avec l'IA" }));
// The streamed proposal appears below the editor: bring it into view while it is written.
const proposalBox = page.getByRole("region", { name: "Proposition de l'IA" });
await proposalBox.waitFor();
const following = setInterval(() => {
  void proposalBox
    .evaluate((element) => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      const text = element.querySelector(".overflow-y-auto");
      text?.scrollTo({ top: text.scrollHeight, behavior: "smooth" });
    })
    .catch(() => undefined);
}, 350);
await page.getByText("Proposition terminée").waitFor({ timeout: 90_000 });
clearInterval(following);
await wait(1500);
await caption("Tu gardes la main : le texte s'utilise, se corrige en Markdown et se relit en aperçu.");
await click(page.getByRole("button", { name: "Utiliser ce texte" }));
await wait(900);
await click(page.getByRole("button", { name: "Aperçu", exact: true }));
await wait(3400);

mark("export");
await caption("Versions nommées, restauration, puis export PDF ou Markdown.");
await click(page.getByRole("tab", { name: "4. Relecture et export" }));
await typeInto(page.getByLabel("Nom de la version"), "Première relecture", 35);
await click(page.getByRole("button", { name: "Enregistrer une version" }));
await page.getByText("Version enregistrée.").waitFor();
await wait(900);
const pdf = page.waitForEvent("download");
await click(page.getByRole("button", { name: "Exporter en PDF" }));
await pdf;
await wait(1800);

mark("cv");
await nav("Outils IA");
await caption("Les outils IA transforment le journal en points CV et en préparation de soutenance.");
await wait(1800);
await click(page.getByRole("button", { name: /Expérience → CV/ }));
for (const text of [
  "Développement de l'API de l'historique",
  "requête lente",
  "Mise en place de l'export CSV",
  "Premier déploiement en préproduction",
]) {
  await click(page.locator("li label").filter({ hasText: text }).first().locator('input[type="checkbox"]'));
}
await caption(
  "Points CV générés à partir des quatre notes choisies, à corriger avant de les enregistrer.",
  "Sortie réelle de phi4-mini rejouée en accéléré.",
);
await click(page.getByRole("button", { name: "Générer les points CV" }));
await page.getByRole("button", { name: "Arrêter" }).waitFor();
await page.getByRole("button", { name: "Arrêter" }).waitFor({ state: "hidden", timeout: 60_000 });
await wait(3200);

mark("theme");
await caption("Thème clair ou sombre, interface accessible au clavier et sur mobile.");
await click(page.getByRole("button", { name: "Passer au thème sombre" }));
await nav("Tableau de bord");
await wait(3000);

mark("profile");
await nav("Mon Profil");
await caption("Le profil vérifie Ollama et le modèle installé, et sauvegarde toutes les données en JSON.");
await wait(1600);
await moveTo(page.getByText("Ollama est joignable."));
await wait(2200);
const exportAll = page.getByRole("link", { name: /Exporter tout/ });
await moveTo(exportAll);
const backupDownload = page.waitForEvent("download");
await exportAll.click();
await backupDownload;
await wait(2600);

mark("end");
await page.evaluate(() => window.__demo.hideCaption());
await page.evaluate((html) => window.__demo.card(html), END_CARD);
await page.mouse.move(1270, 715);
await wait(5000);
await cdp.send("Page.stopScreencast");
const end = Date.now() / 1000;
await browser.close();

// ---------------------------------------------------------------- encoding
// Chrome only sends a frame when the page changes: resample to a constant 30 fps sequence.
const FPS = 30;
const sequenceDir = path.join(outDir, "sequence");
mkdirSync(sequenceDir);
for (let index = 0, step = 0; step < Math.ceil((end - frames[0].t) * FPS); step++) {
  const time = frames[0].t + step / FPS;
  while (index + 1 < frames.length && frames[index + 1].t <= time) index++;
  const source = path.join(framesDir, frames[index].file);
  const target = path.join(sequenceDir, `s${String(step).padStart(5, "0")}.jpg`);
  try {
    linkSync(source, target);
  } catch {
    copyFileSync(source, target);
  }
}
const at = (name) => marks.find((item) => item.name === name).t - frames[0].t;
const ffmpeg = (args) => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    cwd: outDir,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("ffmpeg a échoué");
};
const video = path.join(import.meta.dirname, "stajio-demo.mp4");
ffmpeg([
  "-framerate",
  String(FPS),
  "-i",
  "sequence/s%05d.jpg",
  "-vf",
  "format=yuv420p",
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "22",
  "-tune",
  "stillimage",
  "-movflags",
  "+faststart",
  video,
]);
// README preview: the structuring of a note and the drafting of a report section, slightly sped up.
const clip = (from, to, label) =>
  `[0:v]trim=${at(from).toFixed(2)}:${at(to).toFixed(2)},setpts=(PTS-STARTPTS)/1.25[${label}]`;
ffmpeg([
  "-i",
  video,
  "-filter_complex",
  `${clip("structure", "skills", "a")};${clip("section", "export", "b")};[a][b]concat=n=2:v=1[c];[c]fps=10,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
  path.join(import.meta.dirname, "stajio-demo.gif"),
]);
rmSync(outDir, { recursive: true, force: true });
console.log(`Vidéo de ${(end - frames[0].t).toFixed(0)} s écrite dans docs/demo/`);
