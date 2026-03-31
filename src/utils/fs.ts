import RNFS from 'react-native-fs'
import * as pako from 'pako'
import { Platform } from 'react-native'

export type Encoding = 'utf8' | 'base64' | 'ascii'
export type HashAlgorithm = 'md5' | 'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512'
export interface OpenDocumentOptions {
  extTypes?: string[]
  toPath?: string
}
export interface SelectedPath {
  path: string
  isDirectory: boolean
}
export interface SelectedFile {
  data: string
}
export interface FileType {
  path: string
  name: string
  size: number
  canRead: boolean
  canWrite: boolean
  isDirectory: boolean
  isFile: boolean
  mtime?: number
  ctime?: number
  lastModified?: number
  mimeType?: string
}

const unsupportedPickerError = () => new Error(Platform.OS === 'ios'
  ? 'System document picker is not available in the current iOS build.'
  : 'System document picker is not available in the current build.')

const toBuffer = (input: Uint8Array) => Buffer.from(input.buffer, input.byteOffset, input.byteLength)

const normalizeEncoding = (encoding: Encoding = 'utf8'): 'utf8' | 'base64' | 'ascii' => encoding

const mapStat = async(path: string): Promise<FileType> => {
  const info = await RNFS.stat(path)
  const rawMtime = info.mtime as Date | number | undefined
  const rawCtime = info.ctime as Date | number | undefined
  const mtime = typeof rawMtime === 'number' ? rawMtime : rawMtime?.getTime() ?? 0
  const ctime = typeof rawCtime === 'number' ? rawCtime : rawCtime?.getTime() ?? 0
  return {
    path: info.path,
    name: info.name ?? path.substring(path.lastIndexOf('/') + 1),
    size: Number(info.size),
    canRead: true,
    canWrite: true,
    isDirectory: info.isDirectory(),
    isFile: info.isFile(),
    mtime,
    ctime,
    lastModified: mtime,
  }
}

export const extname = (name: string) => name.lastIndexOf('.') > 0 ? name.substring(name.lastIndexOf('.') + 1) : ''

export const temporaryDirectoryPath = RNFS.CachesDirectoryPath
export const externalStorageDirectoryPath = RNFS.ExternalStorageDirectoryPath ?? RNFS.DocumentDirectoryPath
export const privateStorageDirectoryPath = RNFS.DocumentDirectoryPath

export const getExternalStoragePaths = async() => {
  const paths = [
    RNFS.ExternalStorageDirectoryPath,
    RNFS.ExternalDirectoryPath,
    RNFS.DownloadDirectoryPath,
  ].filter((path): path is string => !!path)
  return Array.from(new Set(paths))
}

export const selectManagedFolder = async(_isPersist: boolean = false): Promise<SelectedPath> => Promise.reject(unsupportedPickerError())
export const selectFile = async(_options: OpenDocumentOptions): Promise<SelectedFile> => Promise.reject(unsupportedPickerError())
export const removeManagedFolder = async(_path: string) => Promise.resolve()
export const getManagedFolders = async() => Promise.resolve([] as string[])

export const getPersistedUriList = async() => Promise.resolve([] as string[])

export const readDir = async(path: string): Promise<FileType[]> => {
  const files = await RNFS.readDir(path)
  return files.map(file => ({
    path: file.path,
    name: file.name,
    size: Number(file.size),
    canRead: true,
    canWrite: true,
    isDirectory: file.isDirectory(),
    isFile: file.isFile(),
    mtime: file.mtime ? file.mtime.getTime() : 0,
    ctime: 0,
    lastModified: file.mtime ? file.mtime.getTime() : 0,
    mimeType: undefined,
  }))
}

export const unlink = async(path: string) => {
  if (!await RNFS.exists(path)) return
  await RNFS.unlink(path)
}

export const mkdir = async(path: string) => RNFS.mkdir(path)

export const stat = async(path: string) => mapStat(path)
export const hash = async(path: string, algorithm: HashAlgorithm) => RNFS.hash(path, algorithm)

export const readFile = async(path: string, encoding: Encoding = 'utf8') => RNFS.readFile(path, normalizeEncoding(encoding))

export const moveFile = async(fromPath: string, toPath: string) => RNFS.moveFile(fromPath, toPath)

export const gzipFile = async(fromPath: string, toPath: string) => {
  const raw = await RNFS.readFile(fromPath, 'base64')
  const gzipped = pako.gzip(Buffer.from(raw, 'base64')) as Uint8Array
  await RNFS.writeFile(toPath, toBuffer(gzipped).toString('base64'), 'base64')
}
export const unGzipFile = async(fromPath: string, toPath: string) => {
  const raw = await RNFS.readFile(fromPath, 'base64')
  const unGzipped = pako.ungzip(Buffer.from(raw, 'base64')) as Uint8Array
  await RNFS.writeFile(toPath, toBuffer(unGzipped).toString('utf8'), 'utf8')
}
export const gzipString = async(data: string, encoding: Encoding = 'utf8') => {
  const input = Buffer.from(data, normalizeEncoding(encoding))
  return toBuffer(pako.gzip(input) as Uint8Array).toString('base64')
}
export const unGzipString = async(data: string, encoding: Encoding = 'utf8') => {
  const input = Buffer.from(data, 'base64')
  return toBuffer(pako.ungzip(input) as Uint8Array).toString(normalizeEncoding(encoding))
}

export const existsFile = async(path: string) => RNFS.exists(path)

export const rename = async(path: string, name: string) => {
  const nextPath = path.replace(/[^/]+$/, name)
  await RNFS.moveFile(path, nextPath)
}

export const writeFile = async(path: string, data: string, encoding: Encoding = 'utf8') => RNFS.writeFile(path, data, normalizeEncoding(encoding))

export const appendFile = async(path: string, data: string, encoding: Encoding = 'utf8') => RNFS.appendFile(path, data, normalizeEncoding(encoding))

export const downloadFile = (url: string, path: string, options: Omit<RNFS.DownloadFileOptions, 'fromUrl' | 'toFile'> = {}) => {
  if (!options.headers) {
    options.headers = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Mobile Safari/537.36',
    }
  }
  return RNFS.downloadFile({
    fromUrl: url, // URL to download file from
    toFile: path, // Local filesystem path to save the file to
    ...options,
    // headers: options.headers, // An object of headers to be passed to the server
    // // background?: boolean;     // Continue the download in the background after the app terminates (iOS only)
    // // discretionary?: boolean;  // Allow the OS to control the timing and speed of the download to improve perceived performance  (iOS only)
    // // cacheable?: boolean;      // Whether the download can be stored in the shared NSURLCache (iOS only, defaults to true)
    // progressInterval: options.progressInterval,
    // progressDivider: options.progressDivider,
    // begin: (res: DownloadBeginCallbackResult) => void;
    // progress?: (res: DownloadProgressCallbackResult) => void;
    // // resumable?: () => void;    // only supported on iOS yet
    // connectionTimeout?: number // only supported on Android yet
    // readTimeout?: number       // supported on Android and iOS
    // // backgroundTimeout?: number // Maximum time (in milliseconds) to download an entire resource (iOS only, useful for timing out background downloads)
  })
}

export const stopDownload = (jobId: number) => {
  RNFS.stopDownload(jobId)
}
