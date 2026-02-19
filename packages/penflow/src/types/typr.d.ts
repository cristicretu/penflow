declare module 'typr.js' {
  const Typr: {
    parse(buffer: ArrayBuffer): any;
    U: {
      codeToGlyph(font: any, codePoint: number): number;
      glyphToPath(font: any, gid: number): { cmds: string[]; crds: number[] };
      getPairAdjustment(font: any, g1: number, g2: number): number;
      stringToGlyphs(font: any, text: string): number[];
    };
  };

  export default Typr;
}
