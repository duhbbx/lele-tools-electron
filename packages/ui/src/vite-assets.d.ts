// Vite worker / asset import suffixes.
// ui does not directly depend on vite; these ambient declarations let vue-tsc type-check
// `?worker`, `?url`, `?raw` imports without errors.
declare module '*?worker' {
  const workerConstructor: { new (options?: { name?: string }): Worker }
  export default workerConstructor
}
declare module '*?worker&inline' {
  const workerConstructor: { new (options?: { name?: string }): Worker }
  export default workerConstructor
}
declare module '*?url' {
  const src: string
  export default src
}
declare module '*?raw' {
  const src: string
  export default src
}
