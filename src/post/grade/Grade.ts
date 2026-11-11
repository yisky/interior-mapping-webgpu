/**
 * 调色。接在泛光后面，还在线性 HDR 里。
 *
 * 暖色、饱和、对比、暗角。这几项运行时改 `.value`。
 * 默认暖色 `0.02`、饱和度 `1.06`、对比度 `1.04`、暗角 `0.28`。
 * ACES、sRGB、抖动在后面的 renderOutput / Dither 里做。
 */

import { TempNode, type Node } from 'three/webgpu'
import {
	Fn,
	float,
	length,
	luminance,
	max,
	mix,
	pow,
	screenUV,
	smoothstep,
	uniform,
	vec2,
	vec3,
	vec4,
} from 'three/tsl'

export interface GradeOptions {
	/** 已经叠过泛光的颜色。`setup` 在它上面调色。 */
	input: Node<'vec4'>
}

export class Grade extends TempNode {

	/** 暖色。正值偏红减蓝。 */
	readonly warmth = uniform( 0.02 )

	/** 饱和度。`1` 是原样，小于 `1` 往灰靠。 */
	readonly saturation = uniform( 1.06 )

	/** 对比度。绕中灰 `0.18` 做幂次。 */
	readonly contrast = uniform( 1.04 )

	/** 暗角强度。`0` 关掉。 */
	readonly vignette = uniform( 0.28 )

	private readonly input: Node<'vec4'>

	constructor( options: GradeOptions ) {

		super( 'vec4' )
		this.input = options.input

	}

	setup(): Node {

		const color = this.input
		const warmth = this.warmth
		const saturation = this.saturation
		const contrast = this.contrast
		const vignetteAmount = this.vignette

		return Fn( () => {

			const warmed = color.rgb.mul( vec3( warmth.add( 1 ), 1, float( 1 ).sub( warmth ) ) )
			const gray = luminance( warmed )
			const saturated = mix( vec3( gray ), warmed, saturation )
			const contrasted = pow( max( saturated, vec3( 0, 0, 0 ) ).div( 0.18 ), vec3( contrast ) ).mul( 0.18 )
			const edge = screenUV.sub( 0.5 ).mul( vec2( 1, 0.8 ) )
			const vignette = float( 1 ).sub( smoothstep( 0.25, 0.75, length( edge ) ).mul( vignetteAmount ) )

			return vec4( contrasted.mul( vignette ), color.a )

		} )() as Node<'vec4'>

	}

}
