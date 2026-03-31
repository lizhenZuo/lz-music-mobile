import { dismissOverlay, showSyncModeModal } from '@/navigation'
import { Navigation } from 'react-native-navigation'
import syncState from '@/store/sync/state'
import syncActions from '@/store/sync/action'
import { type EmitterSubscription } from 'react-native'

type RemoveListener = (() => void) | null
let removeEvent: RemoveListener

export const setSyncStatus = (status: LX.Sync.Status) => {
  syncActions.setStatus(status)
}

export const setSyncMessage = (message: LX.Sync.Status['message']) => {
  syncActions.setMessage(message)
}

export const setSyncModeComponentId = (id: string) => {
  syncActions.setSyncModeComponentId(id)
}

const closeSyncModeModal = () => {
  if (syncState.syncModeComponentId) {
    void dismissOverlay(syncState.syncModeComponentId)
    syncActions.setSyncModeComponentId('')
  }
}
export const selectSyncMode = async<T extends keyof LX.Sync.ModeTypes>(serverName: string, type: T) => new Promise<LX.Sync.ModeTypes[T]>((resolve, reject) => {
  removeSyncModeEvent()
  syncActions.setServerInfo(serverName, type)
  showSyncModeModal()

  const removeListeners = () => {
    removeListener!()
    removeListener = null
    removeEvent = null
    global.app_event.off('selectSyncMode', handleSelectMode)
  }

  const handleSelectMode = ({ mode }: LX.Sync.ModeType) => {
    removeListeners()
    closeSyncModeModal()
    resolve(mode as LX.Sync.ModeTypes[T])
  }

  removeEvent = () => {
    removeListeners()
    reject(new Error('cancel'))
  }

  global.app_event.on('selectSyncMode', handleSelectMode)

  let modalDismissedListener: EmitterSubscription | null = Navigation.events().registerModalDismissedListener(({ componentId }) => {
    if (!modalDismissedListener || componentId != syncState.syncModeComponentId) return
    syncActions.setSyncModeComponentId('')
    removeEvent?.()
    modalDismissedListener.remove()
    modalDismissedListener = null
  })
  let removeListener: RemoveListener = () => {
    if (!modalDismissedListener) return
    modalDismissedListener.remove()
    modalDismissedListener = null
  }
})

export const removeSyncModeEvent = () => {
  if (!removeEvent) return
  removeEvent()
  removeEvent = null
  closeSyncModeModal()
}
