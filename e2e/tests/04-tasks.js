// Tasks: quick adding, adding with details, completing, searching and deleting tasks
const { check, day, icalDay, itemsWith, open, run, unique } = require("../lib");

run(async () => {
  const app = await open();
  const { page } = app;
  await app.loginToPim();
  await page.getByRole("tab", { name: "Tasks" }).click();
  await page.waitForURL(/\/pim\/tasks$/);
  const id = unique();

  // Quick add
  const quickAdd = page.locator("form", { hasText: "Add a new task" }).locator("input");
  const quick = `Buy milk ${id}`;
  await quickAdd.fill(quick);
  await quickAdd.press("Enter");
  await page.getByText(quick).waitFor({ timeout: 10000 }).catch(() => undefined);
  check("the quickly added task is in the list", await page.getByText(quick).isVisible());
  await app.synced();
  let saved = await itemsWith("etebase.vtodo", `SUMMARY:${quick}`);
  check("the quickly added task is on the server", saved.length === 1, saved);
  check("as a task that needs action", /BEGIN:VTODO[\s\S]*STATUS:NEEDS-ACTION/.test(saved[0] || ""), saved[0]);

  // A task with details
  const title = `File the taxes ${id}`;
  await page.locator("button[class*=Fab]").click();
  await page.waitForURL(/\/tasks\/new/);
  await page.locator("input[name=title]").fill(title);
  await page.getByLabel("High").check();
  // The date fields: hide until, and due
  await app.typeDate(page.locator("input[type=text]:not([name])").nth(1), day(5));
  await page.locator("textarea[name=description]").fill("Before the deadline");
  await page.getByRole("textbox", { name: "Tags" }).fill("home");
  await page.getByRole("textbox", { name: "Tags" }).press("Enter");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/pim\/tasks$/);
  await app.synced();
  saved = await itemsWith("etebase.vtodo", `SUMMARY:${title}`);
  check("the task is on the server", saved.length === 1, saved.length);
  const ics = saved[0] || "";
  check("with its priority", /^PRIORITY:1\r?$/m.test(ics), ics);
  check("with its due date", new RegExp(`^DUE;VALUE=DATE:${icalDay(5)}\\r?$`, "m").test(ics), ics);
  check("with its description", ics.includes("DESCRIPTION:Before the deadline"), ics);
  check("with its tag", /^CATEGORIES:home\r?$/m.test(ics), ics);
  check("the task is in the list", await page.getByText(title).isVisible());

  // Searching
  await page.getByPlaceholder("Search").fill("taxes");
  await page.waitForTimeout(300);
  check("searching finds the task", await page.getByText(title).isVisible());
  check("and not the other one", !(await page.getByText(quick).isVisible()));
  await page.getByPlaceholder("Search").fill("");

  // Completing the quick one
  await page.getByText(quick).locator("xpath=ancestor::*[.//input[@type='checkbox']][1]").locator("input[type=checkbox]").click();
  await app.synced();
  await page.waitForTimeout(500);
  saved = await itemsWith("etebase.vtodo", `SUMMARY:${quick}`);
  check("the completed task is completed on the server", /^STATUS:COMPLETED\r?$/m.test(saved[0] || ""), saved[0]);
  check("and isn't in the list anymore", !(await page.getByText(quick).isVisible()));

  // The task page, and deleting from there
  await page.getByText(title).click();
  await page.waitForURL(/\/pim\/tasks\/[^/]+$/);
  const shown = await page.innerText("body");
  check("the task page shows the title", shown.includes(title), shown);
  check("the task page shows the description", shown.includes("Before the deadline"), shown);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForURL(/\/pim\/tasks$/);
  await app.synced();
  saved = await itemsWith("etebase.vtodo", `SUMMARY:${title}`);
  check("the deleted task is gone from the server", saved.length === 0, saved);
  check("and from the list", !(await page.getByText(title).isVisible()));

  check("no sync errors", (await app.syncErrors()) === "", await app.syncErrors());
  await app.close(check);
});
