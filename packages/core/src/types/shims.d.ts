declare module 'gifuct-js' {
  export function parseGIF(buffer: ArrayBuffer): any;
  export function decompressFrames(gif: any, buildImagePatches: boolean): any[];
}

declare module 'lottie-web' {
  const lottie: {
    loadAnimation(params: any): any;
    destroy(name?: string): void;
  };
  export default lottie;
}
