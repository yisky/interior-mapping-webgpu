import { DoubleSide, type Texture } from 'three'
import type { SunLight } from 'three/addons/lights/SunLight.js'
import { dot, float, lightPosition, modelWorldMatrix, pmremTexture, saturate } from 'three/tsl'
import { MeshPhysicalNodeMaterial } from 'three/webgpu'
import type { Period } from '../scene/dayNight'
import { roomNormal, sampleInteriorMap } from './sampleInterior'
import { windowLightsAmount } from './windowLights'

/** 夜里同一张 HDRI 的环境光强度。 */
const NIGHT_ENV = 0.1
/** 白天背光窗的底，避免 NdotL=0 全黑。 */
const DAY_AMBIENT = 0.2

/**
 * 日夜共用 park_parking。室内走 emissive。
 * 白天：室内 × (ambient + (1-ambient) × NdotL)。
 * 夜里：窗灯开关乘在 emissive 和透射上，关掉则室内黑、不穿帮。
 */
export function createInteriorMaterial(
	map: Texture,
	envMap?: Texture | null,
	period: Period = 'day',
	sun?: SunLight | null,
): MeshPhysicalNodeMaterial {
	const interior = sampleInteriorMap( map )
	const material = new MeshPhysicalNodeMaterial()
	material.color.setRGB( 0.05, 0.05, 0.05 )
	material.roughness = 0.01
	material.metalness = 0
	material.ior = 1.5
	material.transmission = 1.0
	material.thickness = 0.2
	material.transparent = false
	material.opacity = 1
	material.depthWrite = true
	material.side = DoubleSide
	material.fog = false
	material.dispersion = 0.5
	material.attenuationColor.set( '#dff5f0' )
	material.attenuationDistance = 1.5
	material.clearcoat = 1.0
	material.clearcoatRoughness = 0.03
	material.lights = true
	material.emissiveNode = interior.rgb
	if ( period === 'night' ) {
		material.emissiveNode = interior.rgb.mul( windowLightsAmount )
		material.transmissionNode = windowLightsAmount
	} else if ( sun != null ) {
		const L = lightPosition( sun ).normalize()
		const N = modelWorldMatrix.transformDirection( roomNormal ).normalize()
		const ndotl = saturate( dot( N, L ) )
		material.emissiveNode = interior.rgb.mul( float( DAY_AMBIENT ).add( ndotl.mul( 1 - DAY_AMBIENT ) ) )
	}
	if ( envMap != null ) {
		const env = pmremTexture( envMap )
		material.envNode = period === 'night' ? env.mul( float( NIGHT_ENV ) ) : env
	}
	return material
}
