<p align="center">
  <img width="120" src="src/images/logo.svg" />
  <h1 align="center">EteSync - Encrypt Everything</h1>
</p>

> [!NOTE]
> **This is an independent fork** of the [EteSync Web App](https://github.com/etesync/etesync-web), the original
> project of the EteSync authors. This fork is not affiliated with, endorsed by or supported by EteSync or
> [etesync.com](https://www.etesync.com) in any way. The history of the original project is kept as it is,
> with its authors, and the changes of this fork follow it. The hosted instance and the links to etesync.com
> below are of the original project. Like the original, it's licensed under the AGPL-3.0.

The EteSync Web App - Use EteSync from the browser!


![GitHub tag](https://img.shields.io/github/tag/etesync/etesync-web.svg)
[![Chat with us](https://img.shields.io/badge/chat-IRC%20|%20Matrix%20|%20Web-blue.svg)](https://www.etebase.com/community-chat/)

For notes, please refer to [the EteSync Notes](https://github.com/etesync/etesync-notes/) repository.

# Usage

A live instance is available on: https://pim.etesync.com

Please be advised that while it's probably safe enough to use the hosted client
in many cases, it's generally not preferable. It's recommended that you use signed
releases which's signature you manually verify and are run locally!

More info is available on the [FAQ](https://www.etesync.com/faq/#web-client).

## Running your own

You can either self-host your own client to be served from your own server, or
better yet, just run an instance locally.

You can get the latest version of the web client from https://pim.etesync.com/etesync-web.tgz. This
file is automatically generated on each deploy and is exactly the same as the deployed version.
After fetching this file you need to extract it by e.g. running `tar -xzf etesync-web.tgz`, and then
you can serve the files using your favourite web server. Please keep in mind that opening the HTML files
directly in the browser is not supported.

If you are just serving the app locally, you could, for example, use the python built-in web server by
running `python3 -m http.server` from inside the extracted `etesync-web` directory. If you plan on
serving it from a server, please use a proper web server such as nginx.

## Building it yourself

Before you can build the web app from source, you need [Node.js](https://nodejs.org/) 20.19 or newer
(which comes with `npm`).

Then clone this repository, run `npm ci` and wait until all of the deps are installed.

Then it's recommended you run `npm run build` to build a production ready client you should serve
(even if run locally!) and then just serve the `build` directory from a web server.
For development, `npm start` runs the app on http://localhost:3000 and reloads it on changes.

The URL of the EteSync API the web app connects to defaults to `api.etebase.com`, but can be changed on
the login page. You can change this default by setting the environment variable `REACT_APP_DEFAULT_API_PATH`
during the build. This can be useful for self-hosting. You can set the default URL to the address
of your self-hosted EteSync server so you don't have to change the address for every login, e.g.:

```
REACT_APP_DEFAULT_API_PATH=https://etebase.example.com/ npm run build
```

### Serving from a subdirectory

In order to run your own version and serve it from a subdirectory rather than the top level of the domain,
set the environment variable `PUBLIC_URL` during the build, e.g. `PUBLIC_URL=/subdir-name/ npm run build`.

### Running it locally as a desktop app

[local-web/](local-web/) has a script that builds the app and serves it on http://localhost:8091 for your
user only, with a menu entry that opens it in its own window. See [local-web/README.md](local-web/README.md).

## Checks

- `npm run lint` and `npx tsc` check the code, `npm test` runs the unit tests.
- [e2e/](e2e/) has browser tests of the whole app against an Etebase test server, see [e2e/README.md](e2e/README.md).
