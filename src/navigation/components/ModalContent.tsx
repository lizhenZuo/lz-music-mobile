import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
// import { useWindowSize } from '@/utils/hooks'
const HEADER_HEIGHT = 20

interface Props {
  children: React.ReactNode
}


export default ({ children }: Props) => {
  const theme = useTheme()

  return (
    <View style={{ ...styles.centeredView, backgroundColor: 'rgba(50,50,50,.3)' }}>
      <View style={{ ...styles.modalView, backgroundColor: theme['c-content-background'] }}>
        <View style={{ ...styles.header, backgroundColor: theme['c-primary-light-100-alpha-100'] }}></View>
        {children}
      </View>
    </View>
  )
}


const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalView: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '82%',
    // backgroundColor: 'white',
    borderRadius: 4,
    overflow: 'hidden',
    // shadowColor: '#000',
    // shadowOffset: {
    //   width: 0,
    //   height: 2,
    // },
    // shadowOpacity: 0.25,
    // shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    height: HEADER_HEIGHT,
  },
})
