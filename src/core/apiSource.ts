// import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@/utils/musicSdk'
// import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { updateSetting } from './common'
import settingState from '@/store/setting/state'
import { destroyUserApi, setUserApi } from './userApi'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { setUserApiStatus } from './userApi'
import { ensureLx } from '@/utils/globalState'


export const setApiSource = (apiId: string) => {
  const lx = ensureLx()
  if (lx.apiInitPromise[1]) {
    lx.apiInitPromise[0] = new Promise(resolve => {
      lx.apiInitPromise[1] = false
      lx.apiInitPromise[2] = (result: boolean) => {
        lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }
  if (/^user_api/.test(apiId)) {
    setUserApi(apiId).catch(err => {
      if (!lx.apiInitPromise[1]) lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      if (api.id != settingState.setting['common.apiSource']) setApiSource(api.id)
    })
  } else {
    // @ts-expect-error
    lx.qualityList = musicSdk.supportQuality[apiId] ?? {}
    destroyUserApi()
    setUserApiStatus(true, '')
    if (!lx.apiInitPromise[1]) lx.apiInitPromise[2](true)
    // apiSource.value = apiId
    // void setUserApiAction(apiId)
  }

  if (apiId != settingState.setting['common.apiSource']) {
    updateSetting({ 'common.apiSource': apiId })
    requestAnimationFrame(() => {
      global.state_event.apiSourceUpdated(apiId)
    })
  }
}
