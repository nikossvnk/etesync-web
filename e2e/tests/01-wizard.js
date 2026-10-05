// A new account: logging in shows the setup, which creates a calendar, an address book and a task list
const { api, check, open, run } = require("../lib");

run(async () => {
  await api.reset();
  const app = await open();
  const { page } = app;
  await app.login();
  await page.getByText("Welcome to EteSync!").waitFor();
  check("the setup is shown for an account without collections", page.url().endsWith("/wizard"), page.url());
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await page.waitForURL(/\/pim/);
  await app.synced();

  const cols = await api.collections();
  check("the setup created a calendar", cols["etebase.vevent"].includes("My Calendar"), cols);
  check("the setup created an address book", cols["etebase.vcard"].includes("My Contacts"), cols);
  check("the setup created a task list", cols["etebase.vtodo"].includes("My Tasks"), cols);
  for (const tab of ["Address Book", "Calendar", "Tasks"]) {
    check(`the ${tab} tab is shown`, await page.getByRole("tab", { name: tab }).isVisible());
  }
  check("no sync errors", (await app.syncErrors()) === "", await app.syncErrors());

  // Logging in again on a new browser doesn't ask for the setup again
  await app.close(check);
  const again = await open();
  await again.login();
  await again.page.waitForURL(/\/pim/, { timeout: 15000 }).catch(() => undefined);
  check("logging in again goes on to the app without the setup", again.page.url().includes("/pim"), again.page.url());
  await again.close(check);
});
