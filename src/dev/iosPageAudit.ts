import { Platform } from 'react-native'
import commonState from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import { navigations, showPactModal, showSyncModeModal, showVersionModal } from '@/navigation'
import playerState from '@/store/player/state'
import { type ListInfoItem } from '@/store/songlist/state'

const wait = async(ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms)
})
const STEP_WAIT = 4000

const mockSonglistInfo = (): ListInfoItem => ({
  id: 'ios-ui-audit-songlist',
  author: 'Codex',
  name: 'iOS UI Audit Songlist',
  desc: 'UI audit placeholder songlist for iOS detail page rendering.',
  img: '',
  play_count: '0',
  source: 'kw',
})

export const runIosPageAudit = async() => {
  if (!__DEV__ || Platform.OS !== 'ios') return
  if (global.lx.isIosPageAuditRunning || global.lx.isIosPageAuditDone) return
  global.lx.isIosPageAuditRunning = true

  try {
    let waitCount = 0
    while (global.lx.isIosRegressionRunning && !global.lx.isIosRegressionDone && waitCount < 20) {
      await wait(1000)
      waitCount++
    }

    await wait(STEP_WAIT)
    console.log('[iOS Page Audit] step=menu_open')
    global.app_event.changeMenuVisible(true)

    await wait(STEP_WAIT)
    console.log('[iOS Page Audit] step=menu_close')
    global.app_event.changeMenuVisible(false)

    await wait(STEP_WAIT)
    console.log('[iOS Page Audit] step=setting')
    setNavActiveId('nav_setting')

    await wait(STEP_WAIT)
    console.log('[iOS Page Audit] step=search')
    setNavActiveId('nav_search')

    const homeId = commonState.componentIds.home
    if (homeId) {
      await wait(STEP_WAIT)
      console.log('[iOS Page Audit] step=songlist_detail')
      navigations.pushSonglistDetailScreen(homeId, mockSonglistInfo())

      await wait(STEP_WAIT)
      console.log('[iOS Page Audit] step=play_detail')
      navigations.pushPlayDetailScreen(homeId, true)

      await wait(STEP_WAIT)
      if (playerState.playMusicInfo.musicInfo) {
        console.log('[iOS Page Audit] step=comment')
        navigations.pushCommentScreen(commonState.componentIds.playDetail ?? homeId)
      } else {
        console.log('[iOS Page Audit] step=comment skipped: no music info')
      }
    }

    await wait(STEP_WAIT)
    console.log('[iOS Page Audit] step=version_modal')
    showVersionModal()

    await wait(STEP_WAIT)
    console.log('[iOS Page Audit] step=sync_modal')
    showSyncModeModal()

    await wait(STEP_WAIT)
    console.log('[iOS Page Audit] step=pact_modal')
    showPactModal()
  } finally {
    global.lx.isIosPageAuditRunning = false
    global.lx.isIosPageAuditDone = true
  }
}
