export const ensureMastraWebGlobals = () => {
  if (typeof globalThis.TransformStream !== "undefined") {
    return;
  }

  const { TransformStream } = require("stream/web");
  Object.assign(globalThis, { TransformStream });
};
