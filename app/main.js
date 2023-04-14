(function () {
  const electron = require("electron");
  const { app } = electron;

  app.disableHardwareAcceleration();

  // This was probably a bad choice for the ID but I think I'm stuck with it now,
  // needed for notifications to work right on Windows.
  app.setAppUserModelId("play.your.damn.turn.client");

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  globalThis.electron = electron;

  app.on("ready", async () => {
    // eslint-disable-next-line
    await import("./main-es.mjs");
  });
})();
