// Creates the test account on the test server (it has to allow signing up, like the test-server
// image of the Etebase server does), if it doesn't exist yet.
const { config, Etebase, api } = require("./lib");
(async () => {
  try {
    const etebase = await api.login();
    console.log(`The account ${config.username} exists already`);
    await etebase.logout();
  } catch (e) {
    if (!(e instanceof Etebase.UnauthorizedError) && !(e instanceof Etebase.NotFoundError)) {
      throw e;
    }
    const etebase = await Etebase.Account.signup({ username: config.username, email: `${config.username}@example.invalid` }, config.password, config.serverUrl);
    await etebase.logout();
    console.log(`Created the account ${config.username}`);
  }
})().catch((e) => { console.log("FAILED", e); process.exit(1); });
