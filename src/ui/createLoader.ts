const GPU = 0.04
const ASSETS = 0.88
const CELLS = 12

const CELL_HTML = '<div class="tw-boot-cell"><div class="tw-boot-fill"></div></div>'

export interface AssetProgress {
	ratio: number
	stage: string
	loaded: number
	total: number
}

export interface BootHandle {
	gpuDone: () => void
	assets: ( progress: AssetProgress ) => void
	prepare: () => void
	finish: () => void
	fail: ( message: string ) => void
	dismiss: () => Promise<void>
}

function mb( n: number ): string {
	return `${ ( n / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`
}

const BOOT_HTML = `
	<div class="tw-boot-card tw-glass">
		<div class="tw-boot-title">室内映射</div>
		<div class="tw-boot-stage">载入场景资源</div>
		<div class="tw-boot-track">${ CELL_HTML.repeat( CELLS ) }</div>
		<div class="tw-boot-meta">
			<div class="tw-boot-sub"></div>
			<span class="tw-boot-pct">0%</span>
		</div>
	</div>`

function ensureBoot(): HTMLElement {
	let root = document.getElementById( 'boot' )
	if ( root === null ) {
		root = document.createElement( 'div' )
		root.id = 'boot'
		document.body.append( root )
	}
	root.className = 'tw-boot'
	root.setAttribute( 'role', 'progressbar' )
	root.setAttribute( 'aria-label', '载入场景资源' )
	root.setAttribute( 'aria-valuemin', '0' )
	root.setAttribute( 'aria-valuemax', '100' )
	root.setAttribute( 'aria-valuenow', '0' )
	if ( root.querySelectorAll( '.tw-boot-cell' ).length !== CELLS ) root.innerHTML = BOOT_HTML
	return root
}

/**
 * 绑到 `index.html` 里的 `#boot`。资源齐、首帧画完后 `dismiss`。
 */
export function bindBoot(): BootHandle {

	const root = ensureBoot()
	const fills = [ ...root.querySelectorAll( '.tw-boot-fill' ) ] as HTMLElement[]
	const pct = root.querySelector( '.tw-boot-pct' ) as HTMLElement
	const stage = root.querySelector( '.tw-boot-stage' ) as HTMLElement
	const sub = root.querySelector( '.tw-boot-sub' ) as HTMLElement
	const reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' )

	let gone = false

	function setBar( t: number ) {
		const v = Math.max( 0, Math.min( 1, t ) )
		const scaled = v * CELLS
		const snap = reduceMotion.matches
		for ( let i = 0; i < fills.length; i ++ ) {
			let f = scaled - i
			if ( snap ) f = f >= 0.5 ? 1 : 0
			fills[ i ]!.style.transform = `scaleX(${ Math.max( 0, Math.min( 1, f ) ) })`
		}
		const n = Math.round( v * 100 )
		pct.textContent = `${ n }%`
		root.setAttribute( 'aria-valuenow', String( n ) )
	}

	stage.textContent = '初始化 WebGPU'
	sub.textContent = ''
	setBar( 0 )

	return {
		gpuDone() {
			setBar( GPU )
		},
		assets( progress ) {
			stage.textContent = progress.stage
			sub.textContent = progress.total > 0
				? `${ progress.stage }  ${ mb( progress.loaded ) } / ${ mb( progress.total ) }`
				: ''
			setBar( GPU + ASSETS * progress.ratio )
		},
		prepare() {
			stage.textContent = '准备画面'
			sub.textContent = ''
			setBar( GPU + ASSETS )
		},
		finish() {
			setBar( 1 )
		},
		fail( message ) {
			if ( gone ) return
			root.setAttribute( 'role', 'alert' )
			root.removeAttribute( 'aria-valuenow' )
			const card = root.querySelector( '.tw-boot-card' )
			if ( card !== null ) {
				card.innerHTML = `<p class="tw-boot-fail">${ message }</p>`
			}
		},
		async dismiss() {
			if ( gone ) return
			gone = true
			root.classList.add( 'is-gone' )
			const reduce = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
			if ( ! reduce ) await new Promise( ( resolve ) => setTimeout( resolve, 280 ) )
			root.remove()
		},
	}

}
