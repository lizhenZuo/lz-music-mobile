import RNFS from 'react-native-fs'

const debugLogPath = `${RNFS.DocumentDirectoryPath}/ios-debug.log`

let writeQueue = Promise.resolve()

const stringify = (value: unknown) => {
  if (typeof value == 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const resetDeviceDebugLog = async() => {
  writeQueue = writeQueue.then(async() => {
    await RNFS.writeFile(debugLogPath, '', 'utf8')
  }).catch(() => {})
  await writeQueue
}

export const appendDeviceDebugLog = async(...parts: unknown[]) => {
  const line = `[${new Date().toISOString()}] ${parts.map(stringify).join(' ')}\n`
  writeQueue = writeQueue.then(async() => {
    await RNFS.appendFile(debugLogPath, line, 'utf8')
  }).catch(() => {})
  await writeQueue
}

export const getDeviceDebugLogPath = () => debugLogPath
