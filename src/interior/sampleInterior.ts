import { InterpolationSamplingMode, InterpolationSamplingType } from 'three'
import type { Texture } from 'three'
import {
	Discard,
	Fn,
	abs,
	attribute,
	cameraPosition,
	cross,
	dot,
	float,
	max,
	min,
	mix,
	modelWorldMatrixInverse,
	normalLocal,
	positionLocal,
	saturate,
	texture,
	varying,
	vec2,
	vec3,
	vec4,
} from 'three/tsl'

/**
 * 预投影图远墙占比，对应文章 `_RoomDepth`。
 * 0.5 时 depthScale = 1，FOV = atan(0.5)。见 public/docs/im-2d.md。
 */
const FAR_FRAC = 0.5

const roomCenter = varying( attribute( 'roomCenter', 'vec3' ) )
	.setInterpolation( InterpolationSamplingType.FLAT, InterpolationSamplingMode.EITHER )
export const roomNormal = varying( attribute( 'roomNormal', 'vec3' ) )
	.setInterpolation( InterpolationSamplingType.FLAT, InterpolationSamplingMode.EITHER )

/**
 * SimCity 5 / 知乎预投影 2D：窗子 UV → 单位立方体 z=-1，切线视线求交后再透视还原回整张图。
 */
export function sampleInteriorMap( map: Texture ) {
	return Fn( () => {
		const roomSize = attribute( 'roomSize', 'vec2' )
		const n = roomNormal.normalize()
		Discard( dot( normalLocal.normalize(), n ).lessThan( 0.5 ) )

		const up = vec3( 0, 1, 0 )
		const uAxis = cross( up, n ).normalize()
		const vAxis = cross( n, uAxis ).normalize()
		const half = roomSize.mul( 0.5 )
		// 方贴图按窗子较长边对齐，短边方向裁掉，避免扁窗把家具拉宽。
		const s = max( half.x, half.y )
		const offset = positionLocal.sub( roomCenter )
		const pos = vec3(
			dot( offset, uAxis ).div( s ),
			dot( offset, vAxis ).div( s ),
			float( -1 ),
		)

		const farFrac = float( FAR_FRAC )
		const depthScale = float( 1 ).div( float( 1 ).sub( farFrac ) ).sub( 1 )

		const camLocal = modelWorldMatrixInverse.mul( vec4( cameraPosition, 1 ) ).xyz
		const viewDir = positionLocal.sub( camLocal )
		const tangentViewDir = vec3(
			dot( viewDir, uAxis ).div( s ),
			dot( viewDir, vAxis ).div( s ),
			dot( viewDir, n ).negate().div( s ).mul( depthScale ),
		)

		const id = vec3( 1, 1, 1 ).div( tangentViewDir )
		const k = abs( id ).sub( pos.mul( id ) )
		const hit = pos.add( tangentViewDir.mul( min( k.x, min( k.y, k.z ) ) ) )

		const interpZ = hit.z.mul( 0.5 ).add( 0.5 )
		const realZ = saturate( interpZ ).div( depthScale ).add( 1 )
		const interp = float( 1 ).sub( float( 1 ).div( realZ ) ).mul( depthScale.add( 1 ) )

		const interiorUV = hit.xy.mul( mix( float( 1 ), farFrac, interp ) ).mul( 0.5 ).add( 0.5 )
		return texture( map, interiorUV )
	} )()
}
