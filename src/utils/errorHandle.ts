import { Alert } from 'react-native'
// import { exitApp } from '@/utils/common'
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler'
import { log } from '@/utils/log'
import { toast } from './tools'

const enableUnhandledPromiseTracking = () => {
  const hermesInternal = (global as typeof globalThis & {
    HermesInternal?: {
      enablePromiseRejectionTracker?: (options: {
        allRejections?: boolean
        onUnhandled?: (id: number, rejection: unknown) => void
        onHandled?: (id: number) => void
      }) => void
    }
  }).HermesInternal
  hermesInternal?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (id, rejection) => {
      const error = rejection instanceof Error ? rejection : null
      const message = error
        ? `${error.name}: ${error.message}`
        : typeof rejection == 'string'
          ? rejection
          : JSON.stringify(rejection)
      const stack = error?.stack ?? (typeof rejection == 'object' && rejection && 'stack' in rejection ? String((rejection as { stack?: unknown }).stack) : '')
      console.log(`[UnhandledPromiseRejection][${id}]`, message, stack)
      if (stack) log.error(stack)
      else log.error(message)
    },
    onHandled: (id) => {
      console.log(`[UnhandledPromiseRejectionHandled][${id}]`)
    },
  })
}

const errorHandler = (e: Error, isFatal: boolean) => {
  const excludedErrors = [
    'Failed to construct \'Response\'',
  ]
  if (isFatal) {
    if (excludedErrors.includes(e.message)) {
      toast('应用遇到了错误，如果你有固定的重现方式，请截图并在 GitHub 反馈（并附上刚才你进行了什么操作，以及“设置-错误日志”的内容）')
    } else {
      Alert.alert(
        '💥Unexpected error occurred💥',
        `
  应用出 bug 了😭，以下是错误异常信息。请截图并在 GitHub 反馈（并附上刚才你进行了什么操作，以及附上“设置-错误日志”的内容）。现在应用可能会出现异常，若出现异常请尝试强制结束应用后重新启动！

  Error:
  ${isFatal ? 'Fatal:' : ''} ${e.name} ${e.message}
  `,
        [{
          text: '关闭 (Close)',
          onPress: () => {
            // exitApp()
          },
        }],
      )
    }
  }
  log.error(e.stack)
}

enableUnhandledPromiseTracking()

if (process.env.NODE_ENV !== 'development') {
  setJSExceptionHandler(errorHandler)

  setNativeExceptionHandler((errorString) => {
    log.error(errorString)
    console.log('+++++', errorString, '+++++')
  }, false)
}
