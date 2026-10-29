import TrackPlayer, { State as TrackPlayerState } from 'react-native-track-player'
import { Platform } from 'react-native'
import { LIST_IDS } from '@/config/constant'
import { overwriteListMusics } from '@/core/list'
import { playList, stop } from '@/core/player/player'
import { search } from '@/core/search/music'
import playerState from '@/store/player/state'
import listState from '@/store/list/state'
import { getListMusics } from '@/utils/listManage'
import { appendDeviceDebugLog } from '@/utils/deviceDebugLog'
import { getBufferedPosition, getDuration, getPosition } from '@/plugins/player/compat'

interface AutoPlayTarget {
  listId: string
  index: number
  musicInfo: LX.Music.MusicInfo
  source: string
}

const REPORT_PREFIX = '[iOS AutoPlay]'
const wait = async(ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms)
})

const log = (...parts: unknown[]) => {
  console.log(REPORT_PREFIX, ...parts)
  void appendDeviceDebugLog(REPORT_PREFIX, ...parts)
}

const waitForApiReady = async() => {
  for (let i = 0; i < 20; i++) {
    if (global.lx.apiInitPromise[1]) break
    await wait(500)
  }
  return global.lx.apiInitPromise[0]
}

const findExistingTarget = async(): Promise<AutoPlayTarget | null> => {
  const listIds = [
    LIST_IDS.DEFAULT,
    LIST_IDS.LOVE,
    ...listState.userList.map(list => list.id),
  ]

  for (const listId of listIds) {
    const list = await getListMusics(listId)
    const index = list.findIndex(musicInfo => musicInfo.source !== 'local')
    if (index < 0) continue
    const musicInfo = list[index]
    return {
      listId,
      index,
      musicInfo,
      source: `list:${listId}`,
    }
  }

  return null
}

const searchTarget = async(): Promise<AutoPlayTarget> => {
  const sources: Array<'kw' | 'kg' | 'tx' | 'wy' | 'mg' | 'all'> = ['kw', 'kg', 'tx', 'wy', 'mg', 'all']
  for (const source of sources) {
    try {
      const list = await search('起风了', 1, source)
      const musicInfo = list[0]
      if (!musicInfo) continue
      await overwriteListMusics(LIST_IDS.TEMP, [musicInfo])
      return {
        listId: LIST_IDS.TEMP,
        index: 0,
        musicInfo,
        source: `search:${source}`,
      }
    } catch (err: any) {
      log('search failed', { source, message: err?.message })
    }
  }
  throw new Error('No playable online song found')
}

const getTarget = async() => {
  return await findExistingTarget() ?? await searchTarget()
}

export const runIosAutoPlay = async() => {
  if (!__DEV__ || Platform.OS !== 'ios') return
  if (global.lx.isIosAutoPlayRunning || global.lx.isIosAutoPlayDone) return
  global.lx.isIosAutoPlayRunning = true

  try {
    const apiReady = await waitForApiReady()
    log('start', { apiReady })
    if (!apiReady) throw new Error('music api source is not ready')

    const target = await getTarget()
    log('target', {
      listId: target.listId,
      index: target.index,
      source: target.source,
      musicId: target.musicInfo.id,
      musicSource: target.musicInfo.source,
      name: target.musicInfo.name,
      singer: target.musicInfo.singer,
    })

    global.lx.restorePlayInfo = null
    await stop().catch(() => {})
    await wait(500)
    await playList(target.listId, target.index)

    let sawPlaying = false
    let maxPosition = 0
    let maxBuffered = 0
    let duration = 0
    const states: string[] = []

    for (let i = 0; i < 36; i++) {
      await wait(500)
      const [state, position, bufferedPosition, currentDuration] = await Promise.all([
        TrackPlayer.getState(),
        getPosition(),
        getBufferedPosition(),
        getDuration(),
      ])
      states.push(String(state))
      sawPlaying ||= state === TrackPlayerState.Playing
      maxPosition = Math.max(maxPosition, position)
      maxBuffered = Math.max(maxBuffered, bufferedPosition)
      duration = Math.max(duration, currentDuration)
      log('poll', {
        i,
        state,
        position,
        bufferedPosition,
        duration: currentDuration,
        isPlay: playerState.isPlay,
        statusText: playerState.statusText,
        playerTrackId: global.lx.playerTrackId,
      })
      if (sawPlaying && maxPosition > 2) break
    }

    const expectedDuration = playerState.progress.maxPlayTime
    const durationSane = expectedDuration <= 0 || duration <= 0 || duration >= expectedDuration * 0.5
    const ok = sawPlaying && maxPosition > 2 && durationSane
    log(ok ? 'PASS' : 'FAIL', {
      sawPlaying,
      maxPosition,
      maxBuffered,
      duration,
      expectedDuration,
      durationSane,
      states,
      currentMusicId: playerState.playMusicInfo.musicInfo?.id,
      currentStatusText: playerState.statusText,
    })
  } catch (err: any) {
    log('FAIL', { message: err?.message, stack: err?.stack })
  } finally {
    global.lx.isIosAutoPlayRunning = false
    global.lx.isIosAutoPlayDone = true
  }
}
