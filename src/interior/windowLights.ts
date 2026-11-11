import { uniform } from 'three/tsl'

/** 夜里窗灯：1 开、0 关。夜景材质共用，白天材质不用。 */
export const windowLightsAmount = uniform( 1 )

export function setWindowLightsAmount( on: boolean ): void {
	windowLightsAmount.value = on ? 1 : 0
}
