interface PlayerStatusState {
  isInitialized: boolean
  isRegisteredService: boolean
  isIniting: boolean
}

type LxState = typeof global.lx

const defaultPlayerStatus: PlayerStatusState = {
  isInitialized: false,
  isRegisteredService: false,
  isIniting: false,
}

const createDefaultLxState = (): LxState => ({
  fontSize: 1,
  gettingUrlId: '',
  playerStatus: { ...defaultPlayerStatus },
  restorePlayInfo: null,
  isScreenKeepAwake: false,
  isPlayedStop: false,
  isEnableSyncLog: false,
  isEnableUserApiLog: false,
  playerTrackId: '',
  qualityList: {},
  apis: {},
  apiInitPromise: [Promise.resolve(false), true, () => {}],
  jumpMyListPosition: false,
  settingActiveId: 'basic',
  homePagerIdle: true,
  isSwitchingPlayerTrack: false,
  isPreparingPlayerTrack: false,
  isIosRegressionRunning: false,
  isIosRegressionDone: false,
  isIosPageAuditRunning: false,
  isIosPageAuditDone: false,
  isIosAutoPlayRunning: false,
  isIosAutoPlayDone: false,
})

export const ensureLx = (): LxState => {
  const lx = global.lx ?? createDefaultLxState()
  lx.playerStatus ??= { ...defaultPlayerStatus }
  lx.qualityList ??= {}
  lx.apis ??= {}
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  lx.apiInitPromise ??= [Promise.resolve(false), true, () => {}]
  lx.fontSize = Number.isFinite(lx.fontSize) && lx.fontSize > 0 ? lx.fontSize : 1
  lx.playerTrackId ??= ''
  lx.gettingUrlId ??= ''
  lx.settingActiveId ??= 'basic'
  lx.isSwitchingPlayerTrack ??= false
  lx.isPreparingPlayerTrack ??= false
  lx.isIosRegressionRunning ??= false
  lx.isIosRegressionDone ??= false
  lx.isIosPageAuditRunning ??= false
  lx.isIosPageAuditDone ??= false
  lx.isIosAutoPlayRunning ??= false
  lx.isIosAutoPlayDone ??= false
  global.lx = lx
  return lx
}

export const ensurePlayerStatus = () => ensureLx().playerStatus
export const ensureQualityList = () => ensureLx().qualityList
