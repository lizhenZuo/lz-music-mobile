import { NativeEventEmitter, NativeModules, Platform } from 'react-native'
import { aesEncryptSync, AES_MODE, rsaEncryptSync, RSA_PADDING } from './crypto'
import { stringMd5 } from 'react-native-quick-md5'

const { UserApiModule } = NativeModules
type Handler = (event: ActionsEvent) => void
const handlers = new Set<Handler>()
let activeScriptCleanup: null | (() => void) = null
let jsApiRequestHandler: null | ((event: LX.UserApi.UserApiRequestParams) => Promise<any>) = null
let isJsInited = false
let isJsShowedUpdateAlert = false
let initTimeout: null | NodeJS.Timeout = null

const emit = (event: ActionsEvent) => {
  if (event.action === 'init' && initTimeout) {
    clearTimeout(initTimeout)
    initTimeout = null
  }
  for (const handler of handlers) handler(event)
}

const stringToBytes = (inputString: string) => Array.from(Buffer.from(inputString, 'utf8'))

const verifyLyricInfo = (info: any) => {
  if (typeof info != 'object' || typeof info.lyric != 'string') throw new Error('failed')
  if (info.lyric.length > 51200) throw new Error('failed')
  return {
    lyric: info.lyric,
    tlyric: (typeof info.tlyric == 'string' && info.tlyric.length < 5120) ? info.tlyric : null,
    rlyric: (typeof info.rlyric == 'string' && info.rlyric.length < 5120) ? info.rlyric : null,
    lxlyric: (typeof info.lxlyric == 'string' && info.lxlyric.length < 8192) ? info.lxlyric : null,
  }
}

type ScriptResponseHandler = (err: Error | null, response: any, body: any) => void
type ScriptAction = 'musicUrl' | 'lyric' | 'pic'
type ScriptRequestPayload = {
  source: string
  action: ScriptAction
  info: any
}
type ScriptRequestResult = {
  source: string
  action: ScriptAction
  data: any
}

const createJsRuntime = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  const requestQueue = new Map<string, { callback: ScriptResponseHandler, aborted: boolean }>()
  const allSources = ['kw', 'kg', 'tx', 'wy', 'mg', 'local']
  const supportQualitys = {
    kw: ['128k', '320k', 'flac', 'flac24bit'],
    kg: ['128k', '320k', 'flac', 'flac24bit'],
    tx: ['128k', '320k', 'flac', 'flac24bit'],
    wy: ['128k', '320k', 'flac', 'flac24bit'],
    mg: ['128k', '320k', 'flac', 'flac24bit'],
    local: [],
  }
  const supportActions = {
    kw: ['musicUrl'],
    kg: ['musicUrl'],
    tx: ['musicUrl'],
    wy: ['musicUrl'],
    mg: ['musicUrl'],
    xm: ['musicUrl'],
    local: ['musicUrl', 'lyric', 'pic'],
  }
  const EVENT_NAMES = {
    request: 'request',
    inited: 'inited',
    updateAlert: 'updateAlert',
  } as const
  const events: { request: null | ((data: any) => Promise<any>) } = {
    request: null,
  }

  isJsInited = false
  isJsShowedUpdateAlert = false
  jsApiRequestHandler = async(data) => {
    if (!events.request) throw new Error('Request event is not defined')
    const payload = data.data as ScriptRequestPayload
    return events.request(payload)
  }

  const utils = {
    crypto: {
      aesEncrypt(buffer: any, mode: string, key: any, iv: any) {
        switch (mode) {
          case 'aes-128-cbc':
            return Buffer.from(aesEncryptSync(
              Buffer.isBuffer(buffer) ? buffer.toString('base64') : Buffer.from(buffer).toString('base64'),
              Buffer.isBuffer(key) ? key.toString('base64') : Buffer.from(key).toString('base64'),
              Buffer.isBuffer(iv) ? iv.toString('base64') : Buffer.from(iv).toString('base64'),
              AES_MODE.CBC_128_PKCS7Padding,
            ), 'base64')
          case 'aes-128-ecb':
            return Buffer.from(aesEncryptSync(
              Buffer.isBuffer(buffer) ? buffer.toString('base64') : Buffer.from(buffer).toString('base64'),
              Buffer.isBuffer(key) ? key.toString('base64') : Buffer.from(key).toString('base64'),
              '',
              AES_MODE.ECB_128_NoPadding,
            ), 'base64')
          default:
            throw new Error('Binary encoding is not supported for input strings')
        }
      },
      rsaEncrypt(buffer: Buffer, key: string) {
        return Buffer.from(rsaEncryptSync(buffer.toString('base64'), key.replace('-----BEGIN PUBLIC KEY-----', '').replace('-----END PUBLIC KEY-----', ''), RSA_PADDING.NoPadding), 'base64')
      },
      randomBytes(size: number) {
        return Uint8Array.from({ length: size }, () => Math.floor(Math.random() * 256))
      },
      md5(str: string) {
        return stringMd5(str)
      },
    },
    buffer: {
      from(input: string | number[], encoding?: string) {
        if (typeof input === 'string') {
          switch (encoding) {
            case 'base64': return Uint8Array.from(Buffer.from(input, 'base64'))
            case 'hex': return Uint8Array.from(Buffer.from(input, 'hex'))
            default: return Uint8Array.from(stringToBytes(input))
          }
        }
        return Uint8Array.from(input)
      },
      bufToString(buf: ArrayLike<number>, format?: string) {
        const buffer = Buffer.from(Array.from(buf))
        switch (format) {
          case 'hex': return buffer.toString('hex')
          case 'base64': return buffer.toString('base64')
          case 'binary': return Array.from(buffer)
          default: return buffer.toString('utf8')
        }
      },
    },
  }

  const lx = {
    EVENT_NAMES,
    request(url: string, { method = 'get', timeout, headers, body, binary }: any, callback: ScriptResponseHandler) {
      const requestKey = Math.random().toString()
      requestQueue.set(requestKey, { callback, aborted: false })
      emit({
        action: 'request',
        data: {
          requestKey,
          url,
          options: {
            method,
            data: body,
            timeout,
            headers,
            binary: binary === true,
          },
        },
      })
      return () => {
        const target = requestQueue.get(requestKey)
        if (!target) return
        target.aborted = true
        requestQueue.delete(requestKey)
        emit({ action: 'cancelRequest', data: requestKey })
      }
    },
    async send(eventName: string, data: any) {
      switch (eventName) {
        case EVENT_NAMES.inited: {
          if (isJsInited) throw new Error('Script is inited')
          isJsInited = true
          const sourceInfo: any = { sources: {} }
          for (const source of allSources) {
            const userSource = data?.sources?.[source]
            if (!userSource || userSource.type !== 'music') continue
            sourceInfo.sources[source] = {
              type: 'music',
              actions: supportActions[source as keyof typeof supportActions].filter(action => userSource.actions.includes(action)),
              qualitys: supportQualitys[source as keyof typeof supportQualitys].filter(quality => userSource.qualitys.includes(quality)),
            }
          }
          emit({ action: 'init', data: { status: true, errorMessage: '', info: sourceInfo } })
          return
        }
        case EVENT_NAMES.updateAlert:
          if (isJsShowedUpdateAlert) throw new Error('The update alert can only be called once.')
          isJsShowedUpdateAlert = true
          emit({ action: 'showUpdateAlert', data: { name: info.name, log: data.log, updateUrl: data.updateUrl } })
          return
        default:
          throw new Error('Unknown event name: ' + eventName)
      }
    },
    async on(eventName: string, handler: (event: any) => Promise<any>) {
      if (eventName !== EVENT_NAMES.request) throw new Error('The event is not supported: ' + eventName)
      events.request = handler
    },
    utils,
    env: Platform.OS,
    version: process.versions.app,
    currentScriptInfo: {
      name: info.name,
      description: info.description,
      version: info.version,
      author: info.author,
      homepage: info.homepage,
    },
  }

  const prevLx = globalThis.lx
  const prevSetTimeout = globalThis.setTimeout
  const prevClearTimeout = globalThis.clearTimeout
  globalThis.lx = lx as any
  globalThis.setTimeout = global.setTimeout
  globalThis.clearTimeout = global.clearTimeout
  try {
    // eslint-disable-next-line no-eval
    ;(0, eval)(info.script)
  } catch (error: any) {
    emit({ action: 'init', data: { status: false, errorMessage: error.message, info: info as any } })
  }
  if (!isJsInited) {
    initTimeout = setTimeout(() => {
      if (isJsInited) return
      emit({
        action: 'init',
        data: {
          status: false,
          errorMessage: 'script init timeout',
          info: info as any,
        },
      })
    }, 15000)
  }

  activeScriptCleanup = () => {
    jsApiRequestHandler = null
    isJsInited = false
    isJsShowedUpdateAlert = false
    if (initTimeout) {
      clearTimeout(initTimeout)
      initTimeout = null
    }
    requestQueue.clear()
    globalThis.lx = prevLx
    globalThis.setTimeout = prevSetTimeout
    globalThis.clearTimeout = prevClearTimeout
  }

  return {
    handleResponse(data: ResponseParams) {
      const target = requestQueue.get(data.requestKey)
      if (!target) return
      requestQueue.delete(data.requestKey)
      if (!data.status) {
        target.callback(new Error(data.errorMessage ?? 'failed'), null, null)
        return
      }
      const result = data.result as ScriptRequestResult
      switch (result.action) {
        case 'musicUrl':
          target.callback(null, {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            body: result.data.url,
          }, result.data.url)
          break
        case 'lyric':
          target.callback(null, {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            body: verifyLyricInfo(result.data),
          }, verifyLyricInfo(result.data))
          break
        case 'pic':
          target.callback(null, {
            statusCode: 200,
            statusMessage: 'OK',
            headers: {},
            body: result.data,
          }, result.data)
          break
        default:
          target.callback(new Error('Unknown action'), null, null)
      }
    },
  }
}
let jsRuntime: ReturnType<typeof createJsRuntime> | null = null

let loadScriptInfo: LX.UserApi.UserApiInfo | null = null
export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  loadScriptInfo = info
  if (!UserApiModule?.loadScript) {
    destroy()
    jsRuntime = createJsRuntime(info)
    return
  }
  UserApiModule.loadScript({
    id: info.id,
    name: info.name,
    description: info.description,
    version: info.version ?? '',
    author: info.author ?? '',
    homepage: info.homepage ?? '',
    script: info.script,
  })
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T]) => {
  if (!UserApiModule?.sendAction) {
    if (action === 'request') {
      void jsApiRequestHandler?.(data as unknown as LX.UserApi.UserApiRequestParams).then(result => {
        const event: ActionsEvent = {
          action: 'response',
          data: {
            status: true,
            requestKey: (data as unknown as LX.UserApi.UserApiRequestParams).requestKey,
            result,
          },
        }
        emit(event)
      }).catch((error: Error) => {
        const event: ActionsEvent = {
          action: 'response',
          data: {
            status: false,
            requestKey: (data as unknown as LX.UserApi.UserApiRequestParams).requestKey,
            errorMessage: error.message,
            result: null,
          },
        }
        emit(event)
      })
    } else if (action === 'response') {
      jsRuntime?.handleResponse(data as unknown as ResponseParams)
    }
    return
  }
  UserApiModule.sendAction(action, JSON.stringify(data))
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  url: string
  options: {
    method: string
    data: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K] } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  if (!UserApiModule) {
    const wrapHandler = (event: ActionsEvent) => {
      if (event.action == 'init') {
        if (event.data.info) event.data.info = { ...loadScriptInfo, ...event.data.info }
        else event.data.info = { ...loadScriptInfo } as any
      } else if (event.action == 'showUpdateAlert') {
        if (!loadScriptInfo?.allowShowUpdateAlert) return
      }
      handler(event)
    }
    handlers.add(wrapHandler)
    return () => {
      handlers.delete(wrapHandler)
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UserApiModule)
  const eventListener = eventEmitter.addListener('api-action', event => {
    if (event.data) event.data = JSON.parse(event.data as string)
    if (event.action == 'init') {
      if (event.data.info) event.data.info = { ...loadScriptInfo, ...event.data.info }
      else event.data.info = { ...loadScriptInfo }
    } else if (event.action == 'showUpdateAlert') {
      if (!loadScriptInfo?.allowShowUpdateAlert) return
    }
    handler(event as ActionsEvent)
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = () => {
  activeScriptCleanup?.()
  activeScriptCleanup = null
  jsRuntime = null
  UserApiModule?.destroy?.()
}
