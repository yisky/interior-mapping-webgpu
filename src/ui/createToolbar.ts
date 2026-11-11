import type { Period } from '../scene/dayNight'

const ICON_SUN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
const ICON_MOON = `<svg class="is-fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 14.3A8.5 8.5 0 1 1 9.7 3 7 7 0 0 0 21 14.3z"/></svg>`
const ICON_WINDOW = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 4v16M4 12h16"/></svg>`
const ICON_BULB = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10c-.7.7-1 1.4-1 2.7H9c0-1.3-.3-2-1-2.7A6 6 0 0 1 12 3z"/></svg>`

export interface ToolbarHandle {
	setPeriod: ( period: Period ) => void
	dispose: () => void
}

function toolButton( icon: string, title: string ): HTMLButtonElement {
	const btn = document.createElement( 'button' )
	btn.type = 'button'
	btn.className = 'tw-tool'
	btn.title = title
	btn.innerHTML = icon
	return btn
}

/**
 * 右下角图标工具条：日夜、室内映射、窗灯（仅夜可用）。
 */
export function createToolbar( options: {
	period: Period
	imEnabled: boolean
	windowLights: boolean
	onPeriod: ( period: Period ) => void
	onIm: ( enabled: boolean ) => void
	onWindowLights: ( on: boolean ) => void
} ): ToolbarHandle {
	let period = options.period
	let imOn = options.imEnabled
	let windowLights = options.windowLights

	const bar = document.createElement( 'div' )
	bar.className = 'tw-toolbar tw-glass'
	bar.setAttribute( 'role', 'toolbar' )
	bar.setAttribute( 'aria-label', '场景控制' )

	const dn = toolButton( ICON_SUN, '夜晚' )
	const im = toolButton( ICON_WINDOW, '室内映射' )
	const win = toolButton( ICON_BULB, '窗灯' )

	function paint() {
		const night = period === 'night'
		dn.innerHTML = night ? ICON_MOON : ICON_SUN
		dn.title = night ? '切换到白天' : '切换到夜晚'
		dn.classList.toggle( 'is-on', night )
		dn.setAttribute( 'aria-pressed', night ? 'true' : 'false' )
		dn.setAttribute( 'aria-label', night ? '夜晚' : '白天' )

		im.classList.toggle( 'is-on', imOn )
		im.title = imOn ? '关闭室内映射' : '打开室内映射'
		im.setAttribute( 'aria-pressed', imOn ? 'true' : 'false' )
		im.setAttribute( 'aria-label', '室内映射' )

		win.classList.toggle( 'is-on', night && windowLights )
		win.disabled = ! night
		win.title = night ? ( windowLights ? '关闭窗灯' : '打开窗灯' ) : '窗灯仅夜晚可用'
		win.setAttribute( 'aria-pressed', night && windowLights ? 'true' : 'false' )
		win.setAttribute( 'aria-label', '窗灯' )
	}

	dn.addEventListener( 'click', () => {
		period = period === 'day' ? 'night' : 'day'
		paint()
		options.onPeriod( period )
	} )
	im.addEventListener( 'click', () => {
		imOn = ! imOn
		paint()
		options.onIm( imOn )
	} )
	win.addEventListener( 'click', () => {
		if ( period !== 'night' ) return
		windowLights = ! windowLights
		paint()
		options.onWindowLights( windowLights )
	} )

	bar.append( dn, im, win )
	document.body.append( bar )
	paint()

	return {
		setPeriod( next ) {
			period = next
			paint()
		},
		dispose() {
			bar.remove()
		},
	}
}
