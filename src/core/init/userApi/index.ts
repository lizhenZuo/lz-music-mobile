import { type InitParams, onScriptAction, sendAction, type ResponseParams, type UpdateInfoParams, type RequestParams } from '@/utils/nativeModules/userApi'
import { log, setUserApiList, setUserApiStatus } from '@/core/userApi'
import settingState from '@/store/setting/state'
import BackgroundTimer from 'react-native-background-timer'
import { fetchData } from './request'
import { addUserApi, getUserApiList, getUserApiScript, updateUserApi } from '@/utils/data'
import { confirmDialog, openUrl, tipDialog } from '@/utils/tools'
import { httpFetch } from '@/utils/request'
import { appendDeviceDebugLog } from '@/utils/deviceDebugLog'
import { builtinUserApiUrls } from './builtinSources'


const parseUserApiMeta = (script: string) => {
  const result = /^\/\*[\S|\s]+?\*\//.exec(script)
  if (!result) return null

  const infoArr = result[0].split(/\r?\n/)
  const rxp = /^\s?\*\s?@(\w+)\s(.+)$/
  const info: Partial<Record<'name' | 'author' | 'homepage', string>> = {}
  for (const item of infoArr) {
    const matched = rxp.exec(item)
    if (!matched) continue
    const key = matched[1]
    if (key !== 'name' && key !== 'author' && key !== 'homepage') continue
    info[key] = matched[2].trim()
  }

  return info
}

const ensureBuiltinUserApis = async() => {
  const currentList = await getUserApiList()
  const currentScripts = await Promise.all(currentList.map(async api => ({
    info: api,
    script: await getUserApiScript(api.id),
  })))

  for (const url of builtinUserApiUrls) {
    let script: string
    try {
      script = await httpFetch(url).promise.then(resp => resp.body) as string
    } catch (err) {
      log.warn('[userApi] builtin import skipped', url, err)
      continue
    }

    const meta = parseUserApiMeta(script)
    const matchedScript = currentScripts.find(({ info, script: currentScript }) => {
      if (currentScript === script) return true
      if (!meta) return false
      if (meta.homepage && info.homepage === meta.homepage) return true
      if (meta.name && meta.author) return info.name === meta.name && info.author === meta.author
      return Boolean(meta.name && info.name === meta.name)
    })
    if (matchedScript) {
      if (matchedScript.script === script) continue
      try {
        const info = await updateUserApi(matchedScript.info.id, script)
        matchedScript.info = info
        matchedScript.script = script
      } catch (err) {
        log.warn('[userApi] builtin update failed', url, err)
      }
      continue
    }

    try {
      const info = await addUserApi(script)
      currentScripts.push({ info, script })
    } catch (err) {
      log.warn('[userApi] builtin add failed', url, err)
    }
  }
}


export default async(setting: LX.AppSetting) => {
  const userApiRequestMap = new Map<string, { resolve: (value: ResponseParams['result']) => void, reject: (error: Error) => void, timeout: number }>()
  const scriptRequestMap = new Map<string, { request: Promise<any>, abort: () => void }>()

  const cancelRequest = (requestKey: string, message: string) => {
    const target = scriptRequestMap.get(requestKey)
    if (!target) return
    scriptRequestMap.delete(requestKey)
    target.abort()
  }
  const sendScriptRequest = (requestKey: string, url: string, options: RequestParams['options']) => {
    let req = fetchData(url, options)
    req.request.then(response => {
      // console.log(response)
      sendAction('response', {
        error: null,
        requestKey,
        response,
      })
    }).catch(err => {
      sendAction('response', {
        error: err.message,
        requestKey,
        response: null,
      })
    }).finally(() => {
      scriptRequestMap.delete(requestKey)
    })
    scriptRequestMap.set(requestKey, req)
  }
  const sendUserApiRequest = async(data: LX.UserApi.UserApiRequestParams) => {
    const requestInfo = {
      requestKey: data.requestKey,
      apiSource: settingState.setting['common.apiSource'],
      source: data.data?.source,
      action: data.data?.action,
      type: data.data?.info?.type,
      musicId: data.data?.info?.musicInfo?.id,
      songmid: data.data?.info?.musicInfo?.songmid,
    }
    log.info('[userApi] send request', requestInfo)
    void appendDeviceDebugLog('[userApi] send request', requestInfo)
    const handleApiUpdate = () => {
      const target = userApiRequestMap.get(data.requestKey)
      if (!target) return
      userApiRequestMap.delete(data.requestKey)
      BackgroundTimer.clearTimeout(target.timeout)
      target.reject(new Error('request failed'))
    }
    const requestPromise = new Promise<ResponseParams['result']>((resolve, reject) => {
      userApiRequestMap.set(data.requestKey, {
        resolve,
        reject,
        timeout: BackgroundTimer.setTimeout(() => {
          const target = userApiRequestMap.get(data.requestKey)
          if (!target) return
          userApiRequestMap.delete(data.requestKey)
          target.reject(new Error('request timeout'))
        }, 20_000),
      })
      sendAction('request', data)
    }).finally(() => {
      global.state_event.off('apiSourceUpdated', handleApiUpdate)
    })
    global.state_event.on('apiSourceUpdated', handleApiUpdate)
    return requestPromise
  }
  const handleUserApiResponse = ({ status, result, requestKey, errorMessage }: ResponseParams) => {
    const responseInfo = {
      requestKey,
      status,
      errorMessage,
      action: result?.action,
      source: result?.source,
      url: typeof result?.data?.url == 'string' ? result.data.url.slice(0, 180) : result?.data,
    }
    log.info('[userApi] request response', responseInfo)
    void appendDeviceDebugLog('[userApi] request response', responseInfo)
    const target = userApiRequestMap.get(requestKey)
    if (!target) return
    userApiRequestMap.delete(requestKey)
    BackgroundTimer.clearTimeout(target.timeout)
    if (status) target.resolve(result)
    else target.reject(new Error(errorMessage ?? 'failed'))
  }
  const syncApiInitPromise = (status: boolean) => {
    if (!global.lx.apiInitPromise[1]) {
      global.lx.apiInitPromise[2](status)
    } else {
      global.lx.apiInitPromise[0] = Promise.resolve(status)
    }
  }
  const handleStateChange = ({ status, errorMessage, info }: InitParams) => {
    const initInfo = {
      status,
      errorMessage,
      id: info?.id,
      name: info?.name,
      sources: info?.sources ? Object.keys(info.sources) : [],
    }
    log.info('[userApi] init state', initInfo)
    void appendDeviceDebugLog('[userApi] init state', initInfo)
    if (!info || info.id !== settingState.setting['common.apiSource']) return
    // 只允许当前选中的自定义源更新状态，避免旧源异步结果覆盖新选择
    setUserApiStatus(status, errorMessage)
    if (status) {
      if (info.sources) {
        let apis: any = {}
        let qualitys: LX.QualityList = {}
        for (const [source, { actions, type, qualitys: sourceQualitys }] of Object.entries(info.sources)) {
          if (type != 'music') continue
          apis[source as LX.Source] = {}
          for (const action of actions) {
            switch (action) {
              case 'musicUrl':
                apis[source].getMusicUrl = (songInfo: LX.Music.MusicInfo, type: LX.Quality) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'musicUrl',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return { type, url: res.data.url }
                    }).catch(err => {
                      console.log(err.message)
                      throw err
                    }),
                  }
                }
                break
              case 'lyric':
                apis[source].getLyric = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'lyric',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return res.data
                    }).catch(async err => {
                      console.log(err.message)
                      return Promise.reject(err)
                    }),
                  }
                }
                break
              case 'pic':
                apis[source].getPic = (songInfo: LX.Music.MusicInfo) => {
                  const requestKey = `request__${Math.random().toString().substring(2)}`
                  return {
                    canceleFn() {
                      // userApiRequestCancel(requestKey)
                    },
                    promise: sendUserApiRequest({
                      requestKey,
                      data: {
                        source,
                        action: 'pic',
                        info: {
                          type,
                          musicInfo: songInfo,
                        },
                      },
                      // eslint-disable-next-line @typescript-eslint/promise-function-async
                    }).then(res => {
                      // console.log(res)
                      return res.data
                    }).catch(async err => {
                      console.log(err.message)
                      return Promise.reject(err)
                    }),
                  }
                }
                break
              default:
                break
            }
          }
          qualitys[source as LX.Source] = sourceQualitys
        }
        global.lx.qualityList = qualitys
        global.lx.apis = apis
        global.state_event.apiSourceUpdated(settingState.setting['common.apiSource'])
      }
    } else {
      if (errorMessage && !(global as typeof globalThis & { __LX_SUPPRESS_NON_CRITICAL_MODALS__?: boolean }).__LX_SUPPRESS_NON_CRITICAL_MODALS__) {
        void tipDialog({
          message: `${global.i18n.t('user_api__init_failed_alert', { name: info.name })}\n${errorMessage}`,
          // selection: true,
          btnText: global.i18n.t('ok'),
        })
      }
    }
    syncApiInitPromise(status)
  }
  const showUpdateAlert = ({ name, log, updateUrl }: UpdateInfoParams) => {
    if ((global as typeof globalThis & { __LX_SUPPRESS_NON_CRITICAL_MODALS__?: boolean }).__LX_SUPPRESS_NON_CRITICAL_MODALS__) return
    if (updateUrl) {
      void confirmDialog({
        message: `${global.i18n.t('user_api_update_alert', { name })}\n${log}`,
        // selection: true,
        // showCancel: true,
        confirmButtonText: global.i18n.t('user_api_update_alert_open_url'),
        cancelButtonText: global.i18n.t('close'),
      }).then(confirm => {
        if (!confirm) return
        setTimeout(() => {
          void openUrl(updateUrl)
        }, 300)
      })
    } else {
      void tipDialog({
        message: `${global.i18n.t('user_api_update_alert', { name })}\n${log}`,
        // selection: true,
        btnText: global.i18n.t('ok'),
      })
    }
  }

  onScriptAction((event) => {
    // console.log('script actuon: ', event)
    switch (event.action) {
      case 'init':
        if ((event as unknown as { errorMessage?: string }).errorMessage) event.data.errorMessage = (event as unknown as { errorMessage: string }).errorMessage
        handleStateChange(event.data)
        break
      case 'response':
        handleUserApiResponse(event.data)
        break
      case 'request':
        sendScriptRequest(event.data.requestKey, event.data.url, event.data.options)
        break
      case 'cancelRequest':
        cancelRequest(event.data, 'request canceled')
        break
      case 'showUpdateAlert':
        showUpdateAlert(event.data)
        break
      case 'log':
        switch ((event as unknown as { type: keyof typeof log }).type) {
          case 'log':
          case 'info':
            log.info((event as unknown as { log: string }).log)
            break
          case 'error':
            log.error((event as unknown as { log: string }).log)
            break
          case 'warn':
            log.warn((event as unknown as { log: string }).log)
            break
          default:
            break
        }
        break
      default:
        break
    }
  })

  await ensureBuiltinUserApis()
  setUserApiList(await getUserApiList())
}
