import type { Labels } from './docks'
import { t } from './i18n'

// Panel titles in the current UI language — used wherever a dock is minted (default layout, + Panel, blocks).
export const dockLabels = (): Labels => ({ search: t('zoneSearch'), image: t('zoneImage'), comment: t('zoneComment'), oracle: t('zoneOracle'), graph: t('zoneGraph') })
