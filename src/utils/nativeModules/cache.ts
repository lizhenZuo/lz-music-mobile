import { NativeModules } from 'react-native'
import RNFS from 'react-native-fs'

const { CacheModule } = NativeModules

const calcDirSize = async(path: string): Promise<number> => {
  if (!path || !await RNFS.exists(path)) return 0
  const files = await RNFS.readDir(path)
  let size = 0
  for (const file of files) {
    size += file.isDirectory() ? await calcDirSize(file.path) : Number(file.size)
  }
  return size
}

export const getAppCacheSize = async(): Promise<number> => {
  if (CacheModule?.getAppCacheSize) return CacheModule.getAppCacheSize().then((size: number) => Math.trunc(size))
  return calcDirSize(RNFS.CachesDirectoryPath).then(size => Math.trunc(size))
}
export const clearAppCache = CacheModule?.clearAppCache
  ? CacheModule.clearAppCache as () => Promise<void>
  : async() => {
      const cachePath = RNFS.CachesDirectoryPath
      if (!cachePath || !await RNFS.exists(cachePath)) return
      const files = await RNFS.readDir(cachePath)
      await Promise.all(files.map(file => RNFS.unlink(file.path).catch(() => {})))
    }
