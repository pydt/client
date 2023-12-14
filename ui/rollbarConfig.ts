export const ROLLBAR_CONFIG = {
  accessToken: "5555ee71eb61470195bb42773371fb7a",
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
