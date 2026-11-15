// Uploads the window bundle's source maps to Rollbar (CivX-Client) after a
// release build, so client stack traces can be mapped back to .ts.
//
// The client rewrites frame paths to http://pydt-client/ui_compiled/<file>
// (rewriteFramePaths in ui/rollbarConfig.ts) and reports the code version
// "<app version>-<platform>" (createEnv.js), so maps are uploaded under the same
// URL and version. Each release job runs this for its own platform.
//
// Needs ROLLBAR_CLIENT_SERVER_TOKEN (a CivX-Client post_server_item token).
// Never fails the build: problems are printed as GitHub Actions warnings.

const fs = require("fs");
const path = require("path");

const FRAME_HOST = "http://pydt-client/";
const uiDir = path.join(__dirname, "..", "app", "ui_compiled");

const warn = message => console.log(`::warning::${message}`);

const upload = async (token, version, mapFile) => {
  const form = new FormData();
  form.append("access_token", token);
  form.append("version", version);
  form.append("minified_url", `${FRAME_HOST}ui_compiled/${mapFile.replace(/\.map$/, "")}`);
  form.append("source_map", new Blob([fs.readFileSync(path.join(uiDir, mapFile))]), mapFile);

  const response = await fetch("https://api.rollbar.com/api/1/sourcemap", { method: "POST", body: form });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
};

const main = async () => {
  const token = process.env.ROLLBAR_CLIENT_SERVER_TOKEN;

  if (!token) {
    console.log("Skipping Rollbar source map upload (no ROLLBAR_CLIENT_SERVER_TOKEN).");
    return;
  }

  const appVersion = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "package.json"), "utf-8")).version;
  const version = `${appVersion}-${process.platform}`;
  const maps = fs.readdirSync(uiDir).filter(f => f.endsWith(".js.map"));
  let failed = 0;

  for (const mapFile of maps) {
    try {
      await upload(token, version, mapFile);
    } catch (e) {
      failed++;
      warn(`Rollbar source map upload failed for ${mapFile}: ${e.message}`);
    }
  }

  console.log(`Uploaded ${maps.length - failed} of ${maps.length} source maps to Rollbar for ${version}.`);
};

main().catch(e => warn(`Rollbar source map upload failed: ${e.message}`));
