import { Platform } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'

type TimerHandler = () => void

const foregroundTimer = {
  setTimeout(handler: TimerHandler, timeout = 0) {
    return globalThis.setTimeout(handler, timeout) as unknown as number
  },
  clearTimeout(id: number) {
    globalThis.clearTimeout(id)
  },
  setInterval(handler: TimerHandler, timeout = 0) {
    return globalThis.setInterval(handler, timeout) as unknown as number
  },
  clearInterval(id: number) {
    globalThis.clearInterval(id)
  },
}

// iOS playback is handled by the native audio session. Keeping JS timers alive
// with background tasks leaks UIApplication background-task assertions.
export default Platform.OS === 'ios' ? foregroundTimer : BackgroundTimer
