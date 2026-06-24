import { Platform } from 'react-native'

export const normalizePlaybackTime = (time: number) => {
  return Platform.OS === 'ios' ? time * 1000 : time
}
