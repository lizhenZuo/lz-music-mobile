import { AppState, Dimensions, Linking, NativeEventEmitter, NativeModules, Platform, Share } from 'react-native'

const { UtilsModule } = NativeModules

const fallbackWindowSize = () => {
  const size = Dimensions.get('window')
  return { width: size.width, height: size.height }
}

const openSettings = async() => {
  try {
    await Linking.openSettings()
    return true
  } catch {
    return false
  }
}

export const exitApp = UtilsModule?.exitApp ?? (() => {})

export const getSupportedAbis = UtilsModule?.getSupportedAbis ?? (async() => Platform.OS === 'ios' ? ['arm64'] : [])

export const installApk = (filePath: string, fileProviderAuthority: string) => {
  if (!UtilsModule?.installApk) return Promise.reject(new Error('Install package is not supported on this platform'))
  return UtilsModule.installApk(filePath, fileProviderAuthority)
}


export const screenkeepAwake = () => {
  if (global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = true
  UtilsModule?.screenkeepAwake?.()
}
export const screenUnkeepAwake = () => {
  // console.log('screenUnkeepAwake')
  if (!global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = false
  UtilsModule?.screenUnkeepAwake?.()
}

export const getWIFIIPV4Address = (UtilsModule?.getWIFIIPV4Address as undefined | (() => Promise<string>)) ?? (async() => '127.0.0.1')

export const getDeviceName = async(): Promise<string> => {
  if (!UtilsModule?.getDeviceName) return Platform.OS === 'ios' ? 'iPhone' : 'Unknown'
  return UtilsModule.getDeviceName().then((deviceName: string) => deviceName || 'Unknown')
}

export const isNotificationsEnabled = (UtilsModule?.isNotificationsEnabled as undefined | (() => Promise<boolean>)) ?? (async() => true)

export const requestNotificationPermission = async() => new Promise<boolean>((resolve) => {
  if (!UtilsModule?.openNotificationPermissionActivity) {
    void openSettings().then(resolve)
    return
  }
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isNotificationsEnabled().then(resolve)
    }, 1000)
  })
  UtilsModule.openNotificationPermissionActivity().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})

export const shareText = async(shareTitle: string, title: string, text: string): Promise<void> => {
  if (UtilsModule?.shareText) {
    UtilsModule.shareText(shareTitle, title, text)
    return
  }
  await Share.share({
    title,
    message: text,
  })
}

export const getSystemLocales = async(): Promise<string> => {
  if (!UtilsModule?.getSystemLocales) return Intl.DateTimeFormat().resolvedOptions().locale
  return UtilsModule.getSystemLocales()
}

export const onScreenStateChange = (handler: (state: 'ON' | 'OFF') => void): () => void => {
  if (!UtilsModule || Platform.OS === 'ios') {
    const subscription = AppState.addEventListener('change', state => {
      handler(state === 'active' ? 'ON' : 'OFF')
    })
    return () => {
      subscription.remove()
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-state', event => {
    handler(event.state as 'ON' | 'OFF')
  })

  return () => {
    eventListener.remove()
  }
}

export const getWindowSize = async(): Promise<{ width: number, height: number }> => {
  if (!UtilsModule?.getWindowSize) return fallbackWindowSize()
  return UtilsModule.getWindowSize()
}

export const onWindowSizeChange = (handler: (size: { width: number, height: number }) => void): () => void => {
  if (!UtilsModule) {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      handler({ width: window.width, height: window.height })
    })
    return () => {
      subscription.remove()
    }
  }
  UtilsModule.listenWindowSizeChanged()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-size-changed', event => {
    handler(event as { width: number, height: number })
  })

  return () => {
    eventListener.remove()
  }
}

export const isIgnoringBatteryOptimization = async(): Promise<boolean> => {
  if (!UtilsModule?.isIgnoringBatteryOptimization) return true
  return UtilsModule.isIgnoringBatteryOptimization()
}

export const requestIgnoreBatteryOptimization = async() => new Promise<boolean>((resolve) => {
  if (!UtilsModule?.requestIgnoreBatteryOptimization) {
    resolve(true)
    return
  }
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isIgnoringBatteryOptimization().then(resolve)
    }, 1000)
  })
  UtilsModule.requestIgnoreBatteryOptimization().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})
