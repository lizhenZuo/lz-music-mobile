/* eslint-disable no-var */
import type { AppEventTypes } from '@/event/appEvent'
import type { ListEventTypes } from '@/event/listEvent'
import type { DislikeEventTypes } from '@/event/dislikeEvent'
import type { StateEventTypes } from '@/event/stateEvent'
import type { I18n } from '@/lang/i18n'
import type { Buffer as _Buffer } from 'buffer'
import type { SettingScreenIds } from '@/screens/Home/Views/Setting'

// interface Process {
//   env: {
//     NODE_ENV: 'development' | 'production'
//   }
//   versions: {
//     app: string
//   }
// }
interface GlobalData {
  fontSize: number
  gettingUrlId: string

  // event_app: AppType
  // event_list: ListType

  playerStatus: {
    isInitialized: boolean
    isRegisteredService: boolean
    isIniting: boolean
  }
  restorePlayInfo: LX.Player.SavedPlayInfo | null
  isScreenKeepAwake: boolean
  isPlayedStop: boolean
  isEnableSyncLog: boolean
  isEnableUserApiLog: boolean
  playerTrackId: string

  qualityList: LX.QualityList
  apis: Partial<LX.UserApi.UserApiSources>
  apiInitPromise: [Promise<boolean>, boolean, (success: boolean) => void]

  jumpMyListPosition: boolean

  settingActiveId: SettingScreenIds

  /**
   * 首页是否正在滚动中，用于防止意外误触播放歌曲
   */
  homePagerIdle: boolean

  /**
   * 播放器是否正在主动切换曲目，避免 iOS reset 阶段误判为空队列结束
   */
  isSwitchingPlayerTrack: boolean

  /**
   * 播放器是否正处于切歌准备阶段，避免 stop/reset 期间的 iOS 伪 ended 事件触发自动下一首
   */
  isPreparingPlayerTrack: boolean

  /**
   * iOS 自动回归检测是否正在运行
   */
  isIosRegressionRunning: boolean

  /**
   * iOS 自动回归检测是否已完成
   */
  isIosRegressionDone: boolean

  /**
   * iOS 页面巡检是否正在运行
   */
  isIosPageAuditRunning: boolean

  /**
   * iOS 页面巡检是否已完成
   */
  isIosPageAuditDone: boolean

  /**
   * iOS 真歌播放检测是否正在运行
   */
  isIosAutoPlayRunning: boolean

  /**
   * iOS 真歌播放检测是否已完成
   */
  isIosAutoPlayDone: boolean

  // windowInfo: {
  //   screenW: number
  //   screenH: number
  //   fontScale: number
  //   pixelRatio: number
  //   screenPxW: number
  //   screenPxH: number
  // }

  // syncKeyInfo: LX.Sync.KeyInfo
}


declare global {
  var isDev: boolean
  var lx: GlobalData
  var i18n: I18n
  var app_event: AppEventTypes
  var list_event: ListEventTypes
  var dislike_event: DislikeEventTypes
  var state_event: StateEventTypes

  var Buffer: typeof _Buffer

  module NodeJS {
    interface ProcessVersions {
      app: string
    }
  }
  // var process: Process
}
