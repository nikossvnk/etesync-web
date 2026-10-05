// Helpers for the browser tests. See README.md for how to run them.
const { chromium } = require("playwright-core");
const Etebase = require("etebase");

const config = {
  // The app, as served by run.js
  appUrl: process.env.E2E_APP_URL || "http://localhost:8766",
  // An Etebase test server, and an account on it that the tests may change (setup.js creates it)
  serverUrl: process.env.E2E_SERVER || "http://127.0.0.1:3735",
  username: process.env.E2E_USER || "web-tester",
  password: process.env.E2E_PASSWORD || "web-tester-password",
  // A Chromium binary, if Playwright's own isn't installed (npx playwright install chromium)
  chromium: process.env.E2E_CHROMIUM || undefined,
};
exports.config = config;
exports.Etebase = Etebase;

let failures = 0;
let lastPage;
let lastErrors = [];
// Prints the result of a check, a failed one makes the test fail (at the end, so that the others still run)
exports.check = (label, ok, detail) => {
  // The details are only shown when it failed
  const shown = (!ok && (detail !== undefined)) ? `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : "";
  console.log(`${ok ? "ok  " : "FAIL"} - ${label}${shown}`);
  if (!ok) {
    failures++;
  }
};
// Runs a test: a thrown error or a failed check makes the process exit with 1
exports.run = (fn) => {
  fn().then(() => {
    process.exit(failures ? 1 : 0);
  }, async (e) => {
    console.log("FAIL - " + e.message.split("\n").slice(0, 4).join(" / "));
    // What the page looked like, to see what went wrong
    if (lastPage && !lastPage.isClosed()) {
      const file = `failed-${require("path").basename(process.argv[1], ".js")}.png`;
      console.log(`       on ${lastPage.url()}, see ${file}`);
      for (const error of lastErrors) {
        console.log(`       error on the page: ${error}`);
      }
      await lastPage.screenshot({ path: require("path").join(__dirname, file) }).catch(() => undefined);
    }
    process.exit(1);
  });
};
exports.unique = () => String(Date.now() % 1000000);

const types = ["etebase.vcard", "etebase.vevent", "etebase.vtodo"];

// Direct access to the account through the Etebase client, to prepare data and check the server's side
exports.api = {
  async login() {
    return Etebase.Account.login(config.username, config.password, config.serverUrl);
  },
  async withAccount(fn) {
    const etebase = await this.login();
    try {
      return await fn(etebase);
    } finally {
      await etebase.logout();
    }
  },
  // Deletes all of the collections, so that the app starts like on a new account
  async reset() {
    await this.withAccount(async (etebase) => {
      const colMgr = etebase.getCollectionManager();
      for (const type of types) {
        for (const col of (await colMgr.list(type)).data) {
          if (!col.isDeleted) {
            col.delete();
            await colMgr.upload(col);
          }
        }
      }
    });
  },
  // The collections (that aren't deleted) by type: { "etebase.vevent": ["My Calendar"], ... }
  async collections() {
    return this.withAccount(async (etebase) => {
      const colMgr = etebase.getCollectionManager();
      const ret = {};
      for (const type of types) {
        ret[type] = (await colMgr.list(type)).data.filter((x) => !x.isDeleted).map((x) => x.getMeta().name);
      }
      return ret;
    });
  },
  // The contents of the items in the collections of a type (that aren't deleted)
  async items(type) {
    return this.withAccount(async (etebase) => {
      const colMgr = etebase.getCollectionManager();
      const ret = [];
      for (const col of (await colMgr.list(type)).data.filter((x) => !x.isDeleted)) {
        let stoken;
        for (;;) {
          const items = await colMgr.getItemManager(col).list({ stoken });
          for (const item of items.data.filter((x) => !x.isDeleted)) {
            ret.push(await item.getContent(Etebase.OutputFormat.String));
          }
          stoken = items.stoken;
          if (items.done) {
            break;
          }
        }
      }
      return ret;
    });
  },
  // Adds an item to the first collection of the type
  async addItem(type, content) {
    await this.withAccount(async (etebase) => {
      const colMgr = etebase.getCollectionManager();
      const col = (await colMgr.list(type)).data.find((x) => !x.isDeleted);
      const itemMgr = colMgr.getItemManager(col);
      const item = await itemMgr.create({ mtime: Date.now() }, content);
      await itemMgr.batch([item]);
    });
  },
};

// The items of a type whose content includes the text
exports.itemsWith = async (type, text) => (await exports.api.items(type)).filter((x) => x.includes(text));

// A browser with the app open. Errors on the page are collected and fail the test in close().
exports.open = async () => {
  const browser = await chromium.launch({ executablePath: config.chromium });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  lastPage = page;
  const errors = [];
  lastErrors = errors;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      errors.push(m.text().slice(0, 300));
    }
  });
  await page.goto(config.appUrl);
  return {
    browser,
    page,
    async login() {
      await page.locator("input:not([type=password])").first().fill(config.username);
      await page.locator("input[type=password]").fill(config.password);
      await page.getByRole("button", { name: "Log In" }).click();
    },
    // Logs in and finishes the setup, if the account has no collections yet
    async loginToPim() {
      await this.login();
      // After logging in the app goes to the setup, which goes on to the app if there are collections
      const welcome = page.getByText("Welcome to EteSync!");
      await Promise.race([page.waitForURL(/\/pim/), welcome.waitFor()]);
      if (!page.url().includes("/pim")) {
        await page.getByRole("button", { name: "Next" }).click();
        await page.getByRole("button", { name: "Finish" }).click();
      }
      await page.waitForURL(/\/pim/);
      await this.synced();
    },
    // Waits for the sync to finish (the refresh button spins while syncing)
    async synced() {
      await page.waitForTimeout(500);
      await page.waitForFunction(() => {
        const refresh = document.querySelector("button[title=Refresh]");
        return refresh && !refresh.disabled && !document.querySelector(".withSpin-spin");
      }, null, { timeout: 30000 });
    },
    async sync() {
      await page.getByTitle("Refresh").click();
      await this.synced();
    },
    // The sync errors shown in the app, if any
    async syncErrors() {
      const button = page.locator("button[title=Errors]");
      if (await button.count() === 0) {
        return "";
      }
      await button.click();
      const text = await page.getByRole("dialog").innerText();
      await page.getByRole("button", { name: "OK" }).click();
      return text;
    },
    // Types into a date field of the date pickers, which only take the input when typed key by key
    async typeDate(input, text) {
      await input.click();
      await input.press("Control+a");
      await input.pressSequentially(text);
    },
    async close(check) {
      check("no errors on the page", errors.length === 0, errors);
      await browser.close();
    },
  };
};

// Today's date and the ones after it in the format of the date fields with the default
// setting, English (United Kingdom): DD/MM/YYYY. With us set, English (United States): MM/DD/YYYY.
exports.day = (offset = 0, us = false) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const [day, month] = [d.getDate(), d.getMonth() + 1].map((x) => String(x).padStart(2, "0"));
  return us ? `${month}/${day}/${d.getFullYear()}` : `${day}/${month}/${d.getFullYear()}`;
};
// The same in the format of iCalendar: YYYYMMDD
exports.icalDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};
