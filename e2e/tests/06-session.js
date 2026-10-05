// Staying logged in, the settings (dark mode and the date format) and logging out
const { check, day, icalDay, itemsWith, open, run, unique } = require("../lib");

async function choose(page, name, option) {
  await page.locator(`input[name=${name}]`).locator("xpath=..").getByRole("button").click();
  await page.getByRole("option", { name: option }).click();
}

run(async () => {
  const app = await open();
  const { page } = app;
  await app.loginToPim();

  await page.reload();
  await page.getByRole("tab", { name: "Calendar" }).waitFor({ timeout: 15000 }).catch(() => undefined);
  check("still logged in after reloading", await page.getByRole("tab", { name: "Calendar" }).isVisible());

  // Dark mode
  await page.goto(new URL("/settings", page.url()).toString());
  await page.getByText("Look & Feel").waitFor();
  const textColor = () => page.evaluate(() => getComputedStyle(document.querySelector("h1")).color);
  const light = await textColor();
  await choose(page, "darkModeUserSelection", "Dark");
  const dark = await textColor();
  check("dark mode changes the text color", light !== dark, [light, dark]);
  await choose(page, "darkModeUserSelection", "Light");
  check("light mode changes them back", (await textColor()) === light, [light, await textColor()]);

  // The American date format is used for typing in dates, once it's chosen
  await choose(page, "locale", "English (United States)");
  await page.goto(new URL("/pim/events/new", page.url()).toString());
  const title = `Tea ${unique()}`;
  await page.locator("input[name=title]").fill(title);
  const dates = page.locator("input[type=text]:not([name])");
  await app.typeDate(dates.nth(0), `${day(8, true)} 16:00`);
  await app.typeDate(dates.nth(1), `${day(8, true)} 17:00`);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/new"));
  await app.synced();
  const saved = await itemsWith("etebase.vevent", `SUMMARY:${title}`);
  check("a date typed in the American format is saved as that day", new RegExp(`DTSTART;TZID=[^:]+:${icalDay(8)}T160000`).test(saved[0] || ""), saved[0]);
  await page.goto(new URL("/settings", page.url()).toString());
  await choose(page, "locale", "English (United Kingdom)");

  // Logging out
  await page.locator("header button").first().click();
  await page.getByText("Log Out").click();
  await page.waitForURL(/\/login/);
  check("logging out goes to the login page", await page.getByRole("button", { name: "Log In" }).isVisible());
  await page.goto(new URL("/pim/events", page.url()).toString());
  await page.waitForTimeout(1000);
  check("the app isn't shown anymore after logging out", !(await page.getByRole("tab", { name: "Calendar" }).isVisible()) && !(await page.innerText("body")).includes(title));
  await page.reload();
  await page.waitForTimeout(1000);
  check("and not after reloading either", !(await page.getByRole("tab", { name: "Calendar" }).isVisible()));

  // Logging out from the calendar
  await app.loginToPim();
  await page.getByRole("tab", { name: "Calendar" }).click();
  await page.locator("header button").first().click();
  await page.getByText("Log Out").click();
  await page.waitForURL(/\/login/);
  check("logging out from the calendar goes to the login page", await page.getByRole("button", { name: "Log In" }).isVisible());
  await app.close(check);
});
