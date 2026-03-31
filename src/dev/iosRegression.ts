import TrackPlayer, { State as TrackPlayerState } from 'react-native-track-player'
import { Platform } from 'react-native'
import {
  temporaryDirectoryPath,
  privateStorageDirectoryPath,
  writeFile,
  unlink,
  existsFile,
  stat,
  downloadFile,
} from '@/utils/fs'
import { getAppCacheSize, clearAppCache } from '@/utils/nativeModules/cache'
import {
  generateRsaKey,
  rsaEncrypt,
  rsaDecrypt,
  rsaEncryptSync,
  rsaDecryptSync,
  aesEncrypt,
  aesDecrypt,
  aesEncryptSync,
  aesDecryptSync,
  RSA_PADDING,
  AES_MODE,
} from '@/utils/nativeModules/crypto'
import { getSystemLocales, isNotificationsEnabled } from '@/utils/nativeModules/utils'
import { getCacheSize as getPlayerCacheSize, clearCache as clearPlayerCache } from '@/plugins/player/utils'
import { initial as playerInitial, setResource } from '@/plugins/player'
import settingState from '@/store/setting/state'
import { ensurePlayerStatus } from '@/utils/globalState'

type TestResult = {
  name: string
  ok: boolean
  details: string
}

type RegressionReport = {
  platform: string
  startedAt: string
  finishedAt: string
  summary: {
    passed: number
    failed: number
  }
  results: TestResult[]
}

const REPORT_PATH = `${privateStorageDirectoryPath}/ios-regression-report.json`
const DOWNLOAD_PATH = `${temporaryDirectoryPath}/ios-download-test.txt`
const CACHE_TEST_PATH = `${temporaryDirectoryPath}/ios-cache-test.txt`
const PLAYBACK_FILE_PATH = `${privateStorageDirectoryPath}/ios-playback-test.mp3`
const PLAYBACK_TEST_URL = 'https://download.samplelib.com/mp3/sample-3s.mp3'

const FIXED_PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4U2m4fBhTkQOOeAlEusFCDa28UI3xZqv
5EGiOZCJ2bH1LfBjwG5dL3Zk2vT6XLaAn7vyXwVYNmdDn4Fa3l8fZndCty1aUAkpxZehZVy/0I+z
Q7QwSvzQpv2yHPQ76Kcuc3E7VEMSPZkx71dQpsDBtE/F04TW6zOxomFcbqUA97QsjNwU8KKSKKJR
2FhjEX0WhJpvDrkAKQBEujwf3pQDa8iUuF4F0v+oCKiSEf6tuWYx5iBpOvXUmZDLPeBnVZuvJM0e
2yXaIYeZorDaosIvCEqVcDPT3gvePZp6eTyffRJmqk7OkyG2epWM1XPXynu85BYK91pZ03YRNBrp
OkdU7wIDAQAB
-----END PUBLIC KEY-----
`

const FIXED_PRIVATE_KEY = `
-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDhTabh8GFORA454CUS6wUINrbx
QjfFmq/kQaI5kInZsfUt8GPAbl0vdmTa9PpctoCfu/JfBVg2Z0OfgVreXx9md0K3LVpQCSnFl6Fl
XL/Qj7NDtDBK/NCm/bIc9Dvopy5zcTtUQxI9mTHvV1CmwMG0T8XThNbrM7GiYVxupQD3tCyM3BTw
opIoolHYWGMRfRaEmm8OuQApAES6PB/elANryJS4XgXS/6gIqJIR/q25ZjHmIGk69dSZkMs94GdV
m68kzR7bJdohh5misNqiwi8ISpVwM9PeC949mnp5PJ99EmaqTs6TIbZ6lYzVc9fKe7zkFgr3WlnT
dhE0Guk6R1TvAgMBAAECggEAOTnF94Fc1cpHar/Z6tIy9wEeumy9Sb2ei3V4RPLHcLnYspBqZcgi
dxm1SEAND1tzlB7i0uvCmh7keDEc6XpzuUz1bx1f4RBSwdNftSU3uzukpr+vvHw2axPpF52ZUeCU
1dGe5iobCfZNTqN44sH28VuJvc3x4M/CgKIGHjxe4IsyxFCIBpitjk829ymWqlUp/xdVxYfY+WFQ
7/SgA48MU2ASyQVzBA4Q3MQ1d8Fn7Ogd+nYdCGaMfRvO0MI9DcB6uj6KoNZ2VxZkT6eXNEkbzCJR
mbsHfWUx39HVGmlKvZefvryYKJoui1jAZw24F2h8WtBkeGIZ3DgyR9QLQaVT4QKBgQD/HkZUcYXw
I8To/YDtO7i0UZ+vj95PHkfYsWizW1pUiFMHc2jxsyXcjYoKebf8gogKAYnwMxs9iZNkQ4V6zAHi
zeE9C3SwMvh4l6MGJo10+/VmD3SaGZpHEs38HPyXqqqIsQEQq/WDiOMeacTY06AzeIAbW1lVHcTA
Xa8N3TOVuQKBgQDiFP9PAy0trTE8lozQHINytluXlsJap3WcRkGxOTR0v8YLHWYVXMQYo+s4s2Qx
t48nwtBeDEI7OVMA2ip7mAC1IwNObYarLztyB1Vz2FJgVpyj63TdTUaxsiOeAbkLzo4r0TCZnuqi
wdkhAWGu4i3hRrnXe6sbb2Dv4zYysNKT5wKBgQCTjN8AV+gvS4DHgFbg3nmlUNAaqgrZl5nWKkVz
9pH38iCTXpyDrilntjTwehV/Zb9oihtNYUGQBdHJW4QH0ZYFpy1uMQH8Jn6uwIT5ObL2xgLYVHgL
6GLiWG3qMpmk3oBjLnx/N/V3beRt4p6HCV7OZhMxv1Obduwklgp46ka7gQKBgQDDGbOpj+gw/sD6
tEEYZ0LYf55TFvrqGJFaJxcRxXgLOGPDu78YuFFRokOfTtAsR2f2vBvszU9qpHGIzrzSo74YkvqL
d+E7YSs/oCySKCAOmy/aFZtoTwOu3Tf3Zy01jy8JiSETsRxzEC48WWDe9rj5K3u9BTAIIPnaio1+
+TEACQKBgQCfdfmP/05Q4Yc2wEtLfiuHatiobIBzdrem0lXS3ZsRsabnddkeGoQ2QvoMo1+D1/CA
BL/KT6V2h9E8eNQVIOpwjxjR9wPBeHVSLhRV0Rh0Lkog4tGwvWVOh+W+ICr+s6Xn9xxvMUiL3Uw6
9qebfBzruW5Gzke5E5/k3K6aCvFm0Q==
-----END PRIVATE KEY-----
`

const wait = async(ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms)
})

const withTimeout = async<T>(label: string, fn: Promise<T>, timeout = 5000): Promise<T> => {
  return Promise.race([
    fn,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout after ${timeout}ms`)), timeout)
    }),
  ])
}

const createPlaybackMusicInfo = (): LX.Player.PlayMusic => {
  return {
    id: 'ios-selftest-track',
    name: 'iOS Self Test',
    singer: 'Codex',
    meta: {
      picUrl: '',
      albumName: 'Regression',
    },
  } as LX.Player.PlayMusic
}

const attemptPlayback = async(url: string) => {
  console.log(`[iOS Regression] playback attempt start: ${String(url)}`)
  await withTimeout('TrackPlayer.reset', TrackPlayer.reset())
  console.log('[iOS Regression] playback reset done')
  setResource(createPlaybackMusicInfo(), url, 0)
  console.log('[iOS Regression] playback setResource invoked')
  await wait(4000)
  const state = await withTimeout('TrackPlayer.getState', TrackPlayer.getState())
  const position = await withTimeout('TrackPlayer.getPosition', TrackPlayer.getPosition())
  console.log(`[iOS Regression] playback status: state=${String(state)} position=${position}`)
  await withTimeout('TrackPlayer.pause', TrackPlayer.pause())
  console.log('[iOS Regression] playback pause done')
  return {
    state,
    position,
    ok: state === TrackPlayerState.Playing || ([
      TrackPlayerState.Paused,
      TrackPlayerState.Stopped,
      TrackPlayerState.Ready,
    ].includes(state) && position > 0.1),
  }
}

const prepareFreshPlayer = async() => {
  try {
    await withTimeout('TrackPlayer.destroy', Promise.resolve(TrackPlayer.destroy()))
  } catch {}
  const playerStatus = ensurePlayerStatus()
  playerStatus.isInitialized = false
  playerStatus.isIniting = false
  await playerInitial({
    volume: settingState.setting['player.volume'],
    playRate: settingState.setting['player.playbackRate'],
    cacheSize: settingState.setting['player.cacheSize'] ? parseInt(settingState.setting['player.cacheSize']) : 0,
    isHandleAudioFocus: settingState.setting['player.isHandleAudioFocus'],
    isEnableAudioOffload: settingState.setting['player.isEnableAudioOffload'],
  })
}

const pushResult = (results: TestResult[], result: TestResult) => {
  results.push(result)
  console.log(`[iOS Regression] ${result.ok ? 'PASS' : 'FAIL'} ${result.name}: ${result.details}`)
}

const testCrypto = async(results: TestResult[]) => {
  try {
    const plain = 'ios-crypto-self-test'
    const plainBase64 = Buffer.from(plain, 'utf8').toString('base64')
    const aesKey = Buffer.from('1234567890abcdef', 'utf8').toString('base64')
    const aesIv = Buffer.from('abcdef1234567890', 'utf8').toString('base64')

    const aesOk = (() => {
      return Promise.all([
        aesEncrypt(plainBase64, aesKey, aesIv, AES_MODE.CBC_128_PKCS7Padding),
      ]).then(async([encrypted]) => {
        const decrypted = await aesDecrypt(encrypted, aesKey, aesIv, AES_MODE.CBC_128_PKCS7Padding)
        const encryptedSync = aesEncryptSync(plainBase64, aesKey, aesIv, AES_MODE.CBC_128_PKCS7Padding)
        const decryptedSync = aesDecryptSync(encryptedSync, aesKey, aesIv, AES_MODE.CBC_128_PKCS7Padding)
        return decrypted === plain && decryptedSync === plain
      })
    })()

    const fixedRsaOk = (() => {
      return Promise.all([
        rsaEncrypt(plainBase64, FIXED_PUBLIC_KEY, RSA_PADDING.OAEPWithSHA1AndMGF1Padding),
      ]).then(async([encrypted]) => {
        const decrypted = await rsaDecrypt(encrypted, FIXED_PRIVATE_KEY, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
        const encryptedSync = rsaEncryptSync(plainBase64, FIXED_PUBLIC_KEY, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
        const decryptedSync = rsaDecryptSync(encryptedSync, FIXED_PRIVATE_KEY, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
        return decrypted === plain && decryptedSync === plain
      })
    })()

    const generatedRsaOk = (async() => {
      const keys = await generateRsaKey()
      const encrypted = await rsaEncrypt(plainBase64, keys.publicKey, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
      const decrypted = await rsaDecrypt(encrypted, keys.privateKey, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
      const encryptedSync = rsaEncryptSync(plainBase64, keys.publicKey, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
      const decryptedSync = rsaDecryptSync(encryptedSync, keys.privateKey, RSA_PADDING.OAEPWithSHA1AndMGF1Padding)
      return decrypted === plain && decryptedSync === plain
    })().catch(() => false)

    const [aesPassed, fixedRsaPassed, generatedRsaPassed] = await Promise.all([aesOk, fixedRsaOk, generatedRsaOk])
    const ok = aesPassed && fixedRsaPassed && generatedRsaPassed

    pushResult(results, {
      name: 'crypto',
      ok,
      details: ok
        ? 'AES/RSA async+sync roundtrip succeeded'
        : `aes=${aesPassed}, rsaFixed=${fixedRsaPassed}, rsaGenerated=${generatedRsaPassed}`,
    })
  } catch (err: any) {
    pushResult(results, {
      name: 'crypto',
      ok: false,
      details: err?.message ?? 'unknown error',
    })
  }
}

const testDownload = async(results: TestResult[]) => {
  try {
    await unlink(DOWNLOAD_PATH).catch(() => {})
    const { promise } = downloadFile('https://www.example.com/', DOWNLOAD_PATH, { readTimeout: 15000, background: false })
    const response = await promise
    const fileExists = await existsFile(DOWNLOAD_PATH)
    const fileInfo = fileExists ? await stat(DOWNLOAD_PATH) : null
    const ok = response.statusCode >= 200 && response.statusCode < 400 && !!fileExists && !!fileInfo && fileInfo.size > 0
    pushResult(results, {
      name: 'download',
      ok,
      details: ok ? `status=${response.statusCode}, bytes=${fileInfo!.size}` : `status=${response.statusCode}, fileExists=${fileExists}`,
    })
  } catch (err: any) {
    pushResult(results, {
      name: 'download',
      ok: false,
      details: err?.message ?? 'unknown error',
    })
  }
}

const testCache = async(results: TestResult[]) => {
  try {
    await unlink(CACHE_TEST_PATH).catch(() => {})
    const before = await getAppCacheSize()
    await writeFile(CACHE_TEST_PATH, 'cache-self-test'.repeat(256), 'utf8')
    const existsBeforeClear = await existsFile(CACHE_TEST_PATH)
    const during = await getAppCacheSize()
    await clearAppCache()
    const existsAfterClear = await existsFile(CACHE_TEST_PATH)
    const after = await getAppCacheSize()
    const ok = existsBeforeClear && !existsAfterClear && during >= before && after <= during

    let playerCacheInfo = ''
    try {
      const playerCacheBefore = await getPlayerCacheSize()
      await clearPlayerCache()
      const playerCacheAfter = await getPlayerCacheSize()
      playerCacheInfo = `, playerCache=${playerCacheBefore}->${playerCacheAfter}`
    } catch {
      playerCacheInfo = ', playerCache=unsupported'
    }

    pushResult(results, {
      name: 'cache',
      ok,
      details: `appCache=${before}->${during}->${after}, clearedTestFile=${!existsAfterClear}${playerCacheInfo}`,
    })
  } catch (err: any) {
    pushResult(results, {
      name: 'cache',
      ok: false,
      details: err?.message ?? 'unknown error',
    })
  }
}

const testPlayback = async(results: TestResult[]) => {
  try {
    await unlink(PLAYBACK_FILE_PATH).catch(() => {})
    const download = downloadFile(PLAYBACK_TEST_URL, PLAYBACK_FILE_PATH, { readTimeout: 15000, background: false })
    const downloadResponse = await download.promise
    const playbackFileExists = await existsFile(PLAYBACK_FILE_PATH)
    const playbackFileStat = playbackFileExists ? await stat(PLAYBACK_FILE_PATH) : null

    await prepareFreshPlayer()
    const fileAttempt = await attemptPlayback(`file://${PLAYBACK_FILE_PATH}`)

    await prepareFreshPlayer()
    const remoteAttempt = await attemptPlayback(PLAYBACK_TEST_URL)

    pushResult(results, {
      name: 'playback',
      ok: remoteAttempt.ok && fileAttempt.ok,
      details: `remoteState=${String(remoteAttempt.state)}, remotePosition=${remoteAttempt.position.toFixed(2)}s, downloadStatus=${downloadResponse.statusCode}, fileState=${String(fileAttempt.state)}, filePosition=${fileAttempt.position.toFixed(2)}s, fileExists=${playbackFileExists}, fileSize=${playbackFileStat?.size ?? -1}, resource=file://${PLAYBACK_FILE_PATH}`,
    })
  } catch (err: any) {
    pushResult(results, {
      name: 'playback',
      ok: false,
      details: err?.message ?? 'unknown error',
    })
  } finally {
    await TrackPlayer.reset().catch(() => {})
    const playerStatus = ensurePlayerStatus()
    playerStatus.isInitialized = false
    playerStatus.isIniting = false
    await unlink(PLAYBACK_FILE_PATH).catch(() => {})
  }
}

const testNotification = async(results: TestResult[]) => {
  try {
    const enabled = await isNotificationsEnabled()
    const locale = await getSystemLocales()
    pushResult(results, {
      name: 'notification',
      ok: true,
      details: `permission=${enabled}, locale=${locale}`,
    })
  } catch (err: any) {
    pushResult(results, {
      name: 'notification',
      ok: false,
      details: err?.message ?? 'unknown error',
    })
  }
}

export const runIosRegression = async() => {
  if (!__DEV__ || Platform.OS !== 'ios') return
  if (global.lx.isIosRegressionRunning || global.lx.isIosRegressionDone) return
  global.lx.isIosRegressionRunning = true

  const results: TestResult[] = []
  const startedAt = new Date().toISOString()

  console.log('[iOS Regression] start')

  try {
    await testCrypto(results)
    await testDownload(results)
    await testCache(results)
    await testPlayback(results)
    await testNotification(results)
  } finally {
    const report: RegressionReport = {
      platform: Platform.OS,
      startedAt,
      finishedAt: new Date().toISOString(),
      summary: {
        passed: results.filter(result => result.ok).length,
        failed: results.filter(result => !result.ok).length,
      },
      results,
    }
    await writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8').catch(() => {})
    console.log(`[iOS Regression] done: ${report.summary.passed} passed, ${report.summary.failed} failed`)
    console.log(`[iOS Regression] report: ${REPORT_PATH}`)
    global.lx.isIosRegressionRunning = false
    global.lx.isIosRegressionDone = true
  }
}
