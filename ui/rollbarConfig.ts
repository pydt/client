export const ROLLBAR_CONFIG = {
  accessToken: "2657e39f6c2847edb4f750a37ef4b20b",
  captureUncaught: true,
  captureUnhandledRejections: true,
  environment: "production",
  ignoredMessages: [
    "Http failure response for https://api.playyourdamnturn.com/metadata",
    "net::ERR_",
    "GET url: https://objects.githubusercontent.com/",
    "ENOENT: no such file or directory, open",
  ],
};
