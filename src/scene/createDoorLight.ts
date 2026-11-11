import { Mesh, PointLight, type MeshStandardMaterial, type Object3D } from 'three'
import type { Period } from './dayNight'

/** glTF 空间、米、Y 向上。灯面中心。 */
const FACE = [ 0, 2.464, 4.97 ] as const
const FACE_NAME = 'Door_CanopyLight_Face'
/** 点光略低于灯面，当下照，不埋进灯片。 */
const DROP = 0.06

/**
 * 门楣筒灯。比路灯干净的暖白，只照门洞和门口石坪。
 * 弱于窗灯，夜里才开，跟窗灯开关无关。
 */
const COLOR = 0xffe2b8
const INTENSITY = 1.8
const DISTANCE = 3
const DECAY = 2
const EMISSIVE_INTENSITY = 1.5

function faceMaterial( root: Object3D ): MeshStandardMaterial | null {
	const obj = root.getObjectByName( FACE_NAME )
	if ( obj === undefined || ( obj as Mesh ).isMesh !== true ) return null
	const mats = ( obj as Mesh ).material
	const mat = ( Array.isArray( mats ) ? mats[ 0 ] : mats ) as MeshStandardMaterial
	if ( mat === undefined || mat.emissive === undefined ) return null
	return mat
}

export function createDoorLight( root: Object3D ): {
	setPeriod: ( period: Period ) => void
	dispose: () => void
} {
	const light = new PointLight( COLOR, INTENSITY, DISTANCE, DECAY )
	light.name = 'DoorCanopyLight'
	light.castShadow = true
	light.shadow.mapSize.setScalar( 512 )
	light.shadow.camera.near = 0.02
	light.shadow.camera.far = DISTANCE
	light.shadow.normalBias = 0.02
	light.visible = false
	light.position.set( FACE[ 0 ], FACE[ 1 ] - DROP, FACE[ 2 ] )
	root.add( light )
	const material = faceMaterial( root )

	function apply( on: boolean ) {
		light.visible = on
		if ( material === null ) return
		if ( on ) {
			material.emissive.setHex( COLOR )
			material.emissiveIntensity = EMISSIVE_INTENSITY
		} else {
			material.emissive.setRGB( 0, 0, 0 )
			material.emissiveIntensity = 0
		}
		material.needsUpdate = true
	}

	return {
		setPeriod( period ) {
			apply( period === 'night' )
		},
		dispose() {
			apply( false )
			light.removeFromParent()
			light.shadow.dispose()
			light.dispose()
		},
	}
}
