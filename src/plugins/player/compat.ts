import { NativeModules, Platform } from 'react-native'
import TrackPlayer, { type NowPlayingMetadata } from 'react-native-track-player'
import { normalizePlaybackTime } from './time'

interface IosTrackPlayerModule {
  updateNowPlayingMetadata: (metadata: NowPlayingMetadata) => Promise<void>
}

const iosTrackPlayer = NativeModules.TrackPlayerModule as IosTrackPlayerModule | undefined

export const getPosition = async() => normalizePlaybackTime(await TrackPlayer.getPosition())
export const getDuration = async() => normalizePlaybackTime(await TrackPlayer.getDuration())
export const getBufferedPosition = async() => normalizePlaybackTime(await TrackPlayer.getBufferedPosition())

export const updateNowPlayingMetadata = async(metadata: NowPlayingMetadata, playing: boolean) => {
  if (Platform.OS === 'ios') {
    if (!iosTrackPlayer?.updateNowPlayingMetadata) throw new Error('TrackPlayer iOS metadata module is unavailable')
    // The bundled iOS bridge updates MPNowPlayingInfoCenter but never settles
    // its promise. Do not let one metadata refresh permanently block later ones.
    void iosTrackPlayer.updateNowPlayingMetadata(metadata).catch((err) => {
      console.log('[TrackPlayer] failed to update iOS now-playing metadata', err)
    })
    return
  }
  return TrackPlayer.updateNowPlayingMetadata(metadata, playing)
}
