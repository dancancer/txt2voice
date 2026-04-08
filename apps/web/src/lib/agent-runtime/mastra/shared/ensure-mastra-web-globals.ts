import { TransformStream as NodeTransformStream } from "stream/web";

export const ensureMastraWebGlobals = () => {
  if (typeof globalThis.TransformStream !== "undefined") {
    return;
  }

  Object.assign(globalThis, { TransformStream: NodeTransformStream });
};
