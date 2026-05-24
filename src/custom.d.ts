/**
 * TypeScript custom module declarations
 * Tells the compiler that GLSL files can be loaded as strings.
 */

declare module '*.glsl' {
  const value: string;
  export default value;
}

declare module '*.vert' {
  const value: string;
  export default value;
}

declare module '*.frag' {
  const value: string;
  export default value;
}
