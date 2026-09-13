import { expect, test } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("landing links to intake and the officer workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Claimaroo/);
  await expect(page.getByRole("link", { name: "Skip to content" })).toHaveAttribute(
    "href",
    "#main",
  );

  await page.getByRole("link", { name: "Start a claim" }).first().click();
  await expect(page).toHaveURL(/\/claim$/);

  await page.goto("/");
  await page.getByRole("link", { name: "Officer workspace" }).first().click();
  await expect(page).toHaveURL(/\/claims$/);
});

test("intake blocks Start until a photo is added", async ({ page }) => {
  await page.goto("/claim");
  await expect(
    page.getByText(
      "Add at least one photo and keep the policy mobile filled in.",
    ),
  ).toBeVisible();
  const start = page.getByRole("button", { name: "Start the call" });
  await expect(start).toHaveAttribute("aria-disabled", "true");
  const phone = page.getByLabel("Mobile on your policy");
  await expect(phone).toHaveValue("");

  const library = page.locator("#cl-photo-library");
  await expect(library).toBeAttached();
  await library.setInputFiles({
    name: "rear-dent.png",
    mimeType: "image/png",
    buffer: PNG,
  });

  await expect(page.getByText("1 photo added", { exact: false })).toBeVisible();
  await expect(start).toHaveAttribute("aria-disabled", "true");

  await phone.fill("0412 000 001");
  await expect(start).not.toHaveAttribute("aria-disabled", "true");
});

test("officer inbox lists the demo claim and Home returns to landing", async ({
  page,
}) => {
  await page.goto("/claims");
  await expect(
    page.getByRole("heading", { name: "Claims dashboard" }),
  ).toBeVisible();
  await expect(page.getByText("CLM-DEMO-A").first()).toBeVisible();

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle(/Claimaroo/);
});

test("seeded case shows officer actions", async ({ page }) => {
  await page.goto("/claims/CLM-DEMO-A");
  await expect(page.getByText("VEHICLE CASE · CLM-DEMO-A")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve next stage" }),
  ).toBeVisible();
});

test("scribe page renders without a live token", async ({ page }) => {
  await page.goto("/scribe");
  await expect(
    page.getByRole("heading", { name: "Talk naturally. See every word." }),
  ).toBeVisible();
});
