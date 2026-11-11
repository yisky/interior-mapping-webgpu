import { Mesh, PointLight, type MeshStandardMaterial, type Object3D } from 'three'
import type { Period } from './dayNight'

/** glTF 空间、米、Y 向上。灯罩中心。 */
const LAMPS = [
	{ name: 'Court_LampShade_1', position: [ -1.2, 0.79, 13.55 ] as const },
	{ name: 'Court_LampShade_2', position: [ 1.2, 0.79, 13.55 ] as const },
	{ name: 'Court_LampShade_3', position: [ -1.2, 0.79, 9.75 ] as const },
	{ name: 'Court_LampShade_4', position: [ 1.2, 0.79, 9.75 ] as const },
	{ name: 'Court_LampShade_5', position: [ -1.2, 0.79, 6.85 ] as const },
	{ name: 'Court_LampShade_6', position: [ 1.2, 0.79, 6.85 ] as const },
	{ name: 'Court_LampShade_7', position: [ -7.0, 0.79, -6.35 ] as const },
	{ name: 'Court_LampShade_8', position: [ 7.0, 0.79, -6.35 ] as const },
	{ name: 'Court_LampShade_9', position: [ -7.0, 0.79, 6.35 ] as const },
	{ name: 'Court_LampShade_10', position: [ 7.0, 0.79, 6.35 ] as const },
] as const

/** 暖路灯。比窗灯略黄、略弱，照草坪和甬道。灯罩自发光同色。 */
const COLOR = 0xffc070
const INTENSITY = 2.4
const DISTANCE = 5.5
const DECAY = 2
const EMISSIVE_INTENSITY = 2.4

function shadeMaterials( root: Object3D ): MeshStandardMaterial[] {
	const seen = new Set<MeshStandardMaterial>()
	for ( const lamp of LAMPS ) {
		const obj = root.getObjectByName( lamp.name )
		if ( obj === undefined || ( obj as Mesh ).isMesh !== true ) continue
		const mats = ( obj as Mesh ).material
		const list = Array.isArray( mats ) ? mats : [ mats ]
		for ( const mat of list ) {
			const std = mat as MeshStandardMaterial
			if ( std.emissive === undefined ) continue
			seen.add( std )
		}
	}
	return [ ...seen ]
}

export function createCourtLights( root: Object3D ): {
	setPeriod: ( period: Period ) => void
	dispose: () => void
} {
	const lights: PointLight[] = []
	for ( const lamp of LAMPS ) {
		const light = new PointLight( COLOR, INTENSITY, DISTANCE, DECAY )
		light.name = `CourtLight_${ lamp.name }`
		light.castShadow = false
		light.visible = false
		light.position.set( lamp.position[ 0 ], lamp.position[ 1 ], lamp.position[ 2 ] )
		root.add( light )
		lights.push( light )
	}
	const materials = shadeMaterials( root )

	function apply( on: boolean ) {
		for ( const light of lights ) light.visible = on
		for ( const mat of materials ) {
			if ( on ) {
				mat.emissive.setHex( COLOR )
				mat.emissiveIntensity = EMISSIVE_INTENSITY
			} else {
				mat.emissive.setRGB( 0, 0, 0 )
				mat.emissiveIntensity = 0
			}
			mat.needsUpdate = true
		}
	}

	return {
		setPeriod( period ) {
			apply( period === 'night' )
		},
		dispose() {
			apply( false )
			for ( const light of lights ) {
				light.removeFromParent()
				light.dispose()
			}
			lights.length = 0
		},
	}
}
