module.exports = {
  mainEntry: "src/main.js",
  preloadEntry: "src/preload.js",
  outDir: "app_compiled",
  mainTarget: "electron16.0-main",
  preloadTarget: "electron16.0-preload",
  externals: {
    fsevents: "require('fsevents')",
  },
};
