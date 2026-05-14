/** Payload when `HypeMeter.currentThreshold` changes after hype math runs. */
export type HypeThresholdChangeContext = {
  lastThreshold: number
  currentThreshold: number
}

export type HypeThresholdChangeListener = (ctx: HypeThresholdChangeContext) => void

/** Logs hype track threshold transitions (for debugging). */
export function createLogHypeThresholdChange(): HypeThresholdChangeListener {
  return ({ lastThreshold, currentThreshold }) => {
    console.log(`[Hype] threshold ${lastThreshold} -> ${currentThreshold}`)
  }
}

export function createSongChangeHypeThresholdListener() : HypeThresholdChangeListener {
  
  return ({lastThreshold, currentThreshold}) => {

  }

}
