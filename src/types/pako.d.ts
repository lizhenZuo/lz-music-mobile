declare module 'pako' {
  export function gzip(data: Uint8Array | ArrayBuffer | Buffer, options?: unknown): Uint8Array
  export function ungzip(data: Uint8Array | ArrayBuffer | Buffer, options?: unknown): Uint8Array
}
