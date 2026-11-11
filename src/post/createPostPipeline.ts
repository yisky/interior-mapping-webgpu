/**
 * 后期：场景 pass → 泛光 → 调色 → renderOutput(ACES + sRGB) → Dither。
 */

import {
	RenderPipeline,
	SRGBColorSpace,
	type Camera,
	type Scene,
	type WebGPURenderer,
	ACESFilmicToneMapping,
} from 'three/webgpu'
import { pass, renderOutput } from 'three/tsl'
import type { Period } from '../scene/dayNight'
import { SceneBloom } from './bloom/Bloom'
import { Dither } from './dither/Dither'
import { Grade } from './grade/Grade'

/** 白天泛光。夜里窗和路灯才需要更明显的晕。 */
const BLOOM_DAY = 0.05
const BLOOM_NIGHT = 0.22

export interface PostPipelineOptions {
	renderer: WebGPURenderer
	scene: Scene
	camera: Camera
}

export interface PostPipelineHandle {
	bloom: SceneBloom
	grade: Grade
	dither: Dither
	scenePass: ReturnType<typeof pass>
	pipeline: RenderPipeline
	setPeriod: ( period: Period ) => void
	render: () => void
	resize: ( width?: number, height?: number ) => void
	dispose: () => void
}

/**
 * `pass` → `color.add(bloom)` → Grade → `renderOutput(ACES, sRGB)` → Dither。
 */
export function createPostPipeline( options: PostPipelineOptions ): PostPipelineHandle {

	const { renderer, scene, camera } = options

	const scenePass = pass( scene, camera )
	const color = scenePass.getTextureNode( 'output' )
	const bloom = new SceneBloom( color )
	bloom.bloom.value = BLOOM_DAY
	// @ts-expect-error
	const grade = new Grade( { input: color.add( bloom ) as never } )

	const pipeline = new RenderPipeline( renderer )
	pipeline.outputColorTransform = false
	const mapped = renderOutput( grade as never, ACESFilmicToneMapping, SRGBColorSpace )
	const dither = new Dither( { input: mapped } )
	pipeline.outputNode = dither

	const resize = ( width?: number, height?: number ) => {

		const w = Math.max( 1, width ?? renderer.domElement.width )
		const h = Math.max( 1, height ?? renderer.domElement.height )
		scenePass.setSize( w, h )

	}

	return {
		bloom,
		grade,
		dither,
		scenePass,
		pipeline,
		setPeriod( period ) {

			bloom.bloom.value = period === 'night' ? BLOOM_NIGHT : BLOOM_DAY

		},
		render: () => {

			pipeline.render()

		},
		resize,
		dispose: () => {

			bloom.dispose()
			scenePass.dispose()
			pipeline.dispose()

		},
	}

}
