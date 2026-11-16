// Runs before the app (listed after "zone.js" in angular.json's polyfills).
// Some dependencies expect a Node-style `global` in the renderer; this has to happen before they load.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(window as any).global = window;
