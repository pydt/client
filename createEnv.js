var fs = require("fs");

const env = process.argv[2];

switch (env) {
  case "prod":
  case "dev":
    break;

  default:
    throw new Error("First arg to script must be dev or prod");
}

const environment = {
  production: env === "prod",
  apiUrl: "https://api.playyourdamnturn.com",
  iotClientAccessKey: process.env.IOT_CLIENT_ACCESS_KEY || "",
  iotClientSecretKey: process.env.IOT_CLIENT_SECRET_KEY || "",
};

if (!environment.production) {
  try {
    environment.apiUrl = fs.readFileSync("../api-dev-url.txt", "utf-8");
    console.log("Using " + environment.apiUrl + " for API URL!");
  } catch (Error) {
    console.log("There wasn't anything in ../api-dev-url.txt, using prod api url...");
  }
}

if (fs.existsSync("iot-client-creds.json")) {
  console.log("Using IoT creds from file...");
  Object.assign(environment, JSON.parse(fs.readFileSync("iot-client-creds.json")));
} else {
  console.log("Using IoT creds from environment...");
}

fs.writeFileSync("ui/environments/environment.build.ts", `export const environment = ${JSON.stringify(environment)};`);
