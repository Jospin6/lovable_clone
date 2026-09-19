import { expect, test } from "@playwright/test";
import { readEventStream } from "../lib/stream";

test("SSE accepts split UTF-8, CRLF, comments and multiple events", async () => {
  const encoder = new TextEncoder();
  const source = ': keepalive\r\n\r\ndata: {"type":"file_delta","path":"index.html","content":"Café 🙂\\nBonjour"}\r\n\r\ndata: {"type":"done","project_id":"test","files":{}}\r\n\r\n';
  const bytes = encoder.encode(source);
  const stream = new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const events = [];
  for await (const event of readEventStream(stream)) events.push(event);
  expect(events).toEqual([{ type: "file_delta", path: "index.html", content: "Café 🙂\nBonjour" }, { type: "done", project_id: "test", files: {} }]);
});

test("home, real proxy stream, preview interactions, code, edits and saved projects", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Les grandes idées/ })).toBeVisible();
  await expect(page.getByText("Agent connecté")).toBeVisible();
  await page.screenshot({ path: "../.test-artifacts/home-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Portfolio", exact: false }).first().click();
  await expect(page.getByLabel("Décrivez le site à créer")).toHaveValue(/portfolio/);
  await page.getByLabel("Décrivez le site à créer").fill("Un site de café");
  await page.getByRole("button", { name: "Générer mon site" }).click();
  await expect(page.getByText("Création en cours", { exact: true })).toBeVisible();
  const preview = page.frameLocator('iframe[title="Aperçu du site généré"]');
  await expect(preview.getByRole("heading", { name: "Bonjour café" })).toBeVisible();
  // The entry point must be visible before the last generated file finishes.
  await expect(page.getByText("Création en cours", { exact: true })).toBeVisible();
  await expect(page.getByText("Prêt à explorer", { exact: true })).toBeVisible();
  await expect.poll(() => preview.locator("script").textContent()).toContain("addEventListener");
  await preview.getByRole("button", { name: "Compteur : 0" }).click();
  await expect(preview.getByRole("button", { name: "Compteur : 1" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveAttribute("sandbox", "allow-scripts");
  const background = await preview.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
  expect(background).toBe("rgb(245, 235, 223)");
  await page.screenshot({ path: "../.test-artifacts/workspace-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Vue mobile", exact: true }).click();
  expect((await page.locator("iframe").boundingBox())?.width).toBeLessThanOrEqual(390);
  await page.getByRole("tab", { name: /Code/ }).click();
  await page.getByRole("button", { name: "script.js", exact: true }).click();
  await expect(page.getByLabel("Code de script.js")).toContainText("addEventListener");
  await page.screenshot({ path: "../.test-artifacts/code-desktop.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger" }).click();
  expect((await download).suggestedFilename()).toBe("Maison-Moka.zip");
  await page.getByLabel("Décrivez vos modifications").fill("Ajoute des horaires");
  await page.getByRole("button", { name: "Envoyer la modification" }).click();
  await expect(page.getByText("Création en cours", { exact: true })).toBeVisible();
  await expect(page.getByText("Prêt à explorer", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Maison Moka", exact: true }).click();
  await expect(preview.getByRole("heading", { name: "Bonjour café" })).toBeVisible();
  await expect(page.getByText("Ajoute des horaires", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("stop aborts the backend through the Next proxy", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("Décrivez le site à créer").fill("Un site lent");
  await page.getByRole("button", { name: "Générer mon site" }).click();
  await expect(page.getByText("Création en cours", { exact: true })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("atelier.projects.v1") || "[]").length)).toBe(1);
  const projectId = await page.evaluate(() => JSON.parse(localStorage.getItem("atelier.projects.v1") || "[]")[0].id);
  await page.getByRole("button", { name: "Arrêter la génération" }).click();
  await expect(page.getByText("En pause", { exact: true })).toBeVisible();
  await expect.poll(async () => (await (await request.get(`http://127.0.0.1:8011/api/projects/${projectId}`)).json()).status, { timeout: 10000 }).toBe("cancelled");
  await expect(page.getByRole("button", { name: "Envoyer la modification" })).toBeVisible();
});

test("connection errors and truncated streams offer a retry", async ({ page }) => {
  await page.route("**/api/generate", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Clé API de test manquante." }) }));
  await page.goto("/");
  await page.getByLabel("Décrivez le site à créer").fill("Un portfolio");
  await page.getByRole("button", { name: "Générer mon site" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Un petit contretemps" })).toContainText("Clé API de test manquante.");
  await page.route("**/api/generate", (route) => route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"stage","stage":"planning","message":"Plan"}\n\n' }));
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Un petit contretemps" })).toContainText("La connexion a été interrompue");
});

test("mobile navigation and layout have no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".agent-connection")).toContainText("Agent connecté");
  await page.screenshot({ path: "../.test-artifacts/home-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.getByRole("button", { name: "Mes projets", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tout commence par une idée." })).toBeVisible();
  await page.getByRole("button", { name: "Créer mon premier site" }).click();
  await page.getByLabel("Décrivez le site à créer").fill("Un café mobile");
  await page.getByRole("button", { name: "Générer mon site" }).click();
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "Bonjour café" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer la modification" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.test-artifacts/workspace-mobile.png", fullPage: true });
});
