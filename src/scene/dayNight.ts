import {
	Color,
	HemisphereLight,
	Scene,
	type Mesh,
} from 'three'
import { mix, screenUV, smoothstep, uniform } from 'three/tsl'
import type { SunLight } from 'three/addons/lights/SunLight.js'
import type { MeshBasicNodeMaterial } from 'three/webgpu'

export type Period = 'day' | 'night'

export const PERIODS = {
	day: {
		bgTop: 0xBFC5D1,
		bgMid: 0xC8CEDA,
		bgBot: 0xCDD4DE,
		hemiSky: 0xe8dcc8,
		hemiGround: 0x6a645c,
		hemiIntensity: 0.55,
		sunColor: 0xfff6ee,
		sunIntensity: 5.6,
		exposure: 1,
		groundColor: 0x5c6570,
		groundOpacity: 0.28,
		envUrl: null as string | null,
	},
	night: {
		bgTop: 0x07090d,
		bgMid: 0x0a0c10,
		bgBot: 0x050608,
		hemiSky: 0x1a2230,
		hemiGround: 0x0c0e12,
		hemiIntensity: 0.06,
		sunColor: 0xb8c8e0,
		sunIntensity: 0.08,
		exposure: 0.88,
		groundColor: 0x08090c,
		groundOpacity: 0.32,
		envUrl: null as string | null,
	},
} as const

type StudioScene = Scene & { backgroundNode?: unknown, environment?: unknown }

export function createDayNightLook( options: {
	renderer: { toneMappingExposure: number }
	scene: StudioScene
	hemi: HemisphereLight
	sun: SunLight
	ground: Mesh
} ) {
	const bgTop = uniform( new Color( PERIODS.day.bgTop ) )
	const bgMid = uniform( new Color( PERIODS.day.bgMid ) )
	const bgBot = uniform( new Color( PERIODS.day.bgBot ) )
	const y = screenUV.y
	options.scene.backgroundNode = mix(
		mix( bgBot, bgMid, smoothstep( 0, 0.5, y ) ),
		bgTop,
		smoothstep( 0.5, 1, y ),
	)

	let period: Period = 'day'

	function applyEnvironment( url: string | null ) {
		void url
		options.scene.environment = null
	}

	function setPeriod( next: Period ) {
		period = next
		const p = PERIODS[ next ]
		bgTop.value.setHex( p.bgTop )
		bgMid.value.setHex( p.bgMid )
		bgBot.value.setHex( p.bgBot )
		options.hemi.color.setHex( p.hemiSky )
		options.hemi.groundColor.setHex( p.hemiGround )
		options.hemi.intensity = p.hemiIntensity
		options.sun.color.setHex( p.sunColor )
		options.sun.intensity = p.sunIntensity
		options.renderer.toneMappingExposure = p.exposure
		const groundMat = options.ground.material as MeshBasicNodeMaterial
		groundMat.color.setHex( p.groundColor )
		groundMat.opacity = p.groundOpacity
		applyEnvironment( p.envUrl )
	}

	setPeriod( 'day' )
	return {
		get period() { return period },
		setPeriod,
	}
}
