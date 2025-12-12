export interface Uniforms {
  density: number;
  scatteringG: number;
  lightAngle: number;
  steps: number;
  dithering: boolean;
  shadowSoftness: number;
}

export enum Tab {
  RENDER = 'RENDER',
  DOCS = 'DOCS',
  CODE = 'CODE',
}
