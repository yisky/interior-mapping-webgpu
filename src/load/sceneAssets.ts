import {
	ClampToEdgeWrapping,
	EquirectangularReflectionMapping,
	SRGBColorSpace,
	Texture,
	TextureLoader,
} from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { IM_DIR, listInteriorMapUrls } from '../interior/setupInteriorMapping'
import type { AssetProgress } from '../ui/createLoader'
import { fetchBuffer } from './fetchBuffer'
import type { AssetQuality } from './quality'

export const MODEL_URL = '/models/studio_3f_im_compressed.glb'
export const ENV_URL = {
	full: '/textures/env/park_parking_2k.hdr',
	lite: '/textures/env/park_parking_512.hdr',
} as const
export const BASIS_PATH = '/basis/'

type KtxRenderer = {
	isWebGPURenderer?: boolean
	hasFeature: ( name: string ) => boolean
}

/** 本地体积，没有 Content-Length 时用。键不含 query。 */
const BYTES: Record<string, number> = {
	'/models/studio_3f_im_compressed.glb': 10439880,
	'/textures/env/park_parking_2k.hdr': 6855634,
	'/textures/env/park_parking_512.hdr': 416048,
	'/textures/im/L0/day-N-L0-C.png': 2190425,
	'/textures/im/L0/day-N-L0-E.png': 2702936,
	'/textures/im/L0/day-N-L0-W.png': 2447411,
	'/textures/im/L0/day-S-L0-E.png': 2178980,
	'/textures/im/L0/day-S-L0-W.png': 2269495,
	'/textures/im/L0/night-N-L0-C.png': 2103481,
	'/textures/im/L0/night-N-L0-E.png': 2278061,
	'/textures/im/L0/night-N-L0-W.png': 2404415,
	'/textures/im/L0/night-S-L0-E.png': 2154512,
	'/textures/im/L0/night-S-L0-W.png': 2256228,
	'/textures/im/L1/day-N-L1-C.png': 2610067,
	'/textures/im/L1/day-N-L1-E.png': 2216139,
	'/textures/im/L1/day-N-L1-W.png': 2092368,
	'/textures/im/L1/day-S-L1-C.png': 2619854,
	'/textures/im/L1/day-S-L1-E.png': 1522893,
	'/textures/im/L1/day-S-L1-W.png': 2959956,
	'/textures/im/L1/night-N-L1-C.png': 3045208,
	'/textures/im/L1/night-N-L1-E.png': 2771952,
	'/textures/im/L1/night-N-L1-W.png': 2740272,
	'/textures/im/L1/night-S-L1-C.png': 3146084,
	'/textures/im/L1/night-S-L1-E.png': 2150815,
	'/textures/im/L1/night-S-L1-W.png': 3892303,
	'/textures/im/L2/day-N-L2-C.png': 3006575,
	'/textures/im/L2/day-N-L2-E.png': 1792515,
	'/textures/im/L2/day-N-L2-W.png': 2671219,
	'/textures/im/L2/day-S-L2-C.png': 2521688,
	'/textures/im/L2/day-S-L2-E.png': 1843795,
	'/textures/im/L2/day-S-L2-W.png': 2646981,
	'/textures/im/L2/night-N-L2-C.png': 3403177,
	'/textures/im/L2/night-N-L2-E.png': 2435515,
	'/textures/im/L2/night-N-L2-W.png': 3428755,
	'/textures/im/L2/night-S-L2-C.png': 3105361,
	'/textures/im/L2/night-S-L2-E.png': 2386977,
	'/textures/im/L2/night-S-L2-W.png': 3612426,
	'/textures/im-512/L0/day-N-L0-C.png': 247323,
	'/textures/im-512/L0/day-N-L0-E.png': 293430,
	'/textures/im-512/L0/day-N-L0-W.png': 266097,
	'/textures/im-512/L0/day-S-L0-E.png': 250581,
	'/textures/im-512/L0/day-S-L0-W.png': 256671,
	'/textures/im-512/L0/night-N-L0-C.png': 250866,
	'/textures/im-512/L0/night-N-L0-E.png': 259066,
	'/textures/im-512/L0/night-N-L0-W.png': 270799,
	'/textures/im-512/L0/night-S-L0-E.png': 262404,
	'/textures/im-512/L0/night-S-L0-W.png': 269572,
	'/textures/im-512/L1/day-N-L1-C.png': 275710,
	'/textures/im-512/L1/day-N-L1-E.png': 245364,
	'/textures/im-512/L1/day-N-L1-W.png': 244174,
	'/textures/im-512/L1/day-S-L1-C.png': 279515,
	'/textures/im-512/L1/day-S-L1-E.png': 186040,
	'/textures/im-512/L1/day-S-L1-W.png': 288118,
	'/textures/im-512/L1/night-N-L1-C.png': 281489,
	'/textures/im-512/L1/night-N-L1-E.png': 263109,
	'/textures/im-512/L1/night-N-L1-W.png': 254605,
	'/textures/im-512/L1/night-S-L1-C.png': 287128,
	'/textures/im-512/L1/night-S-L1-E.png': 213013,
	'/textures/im-512/L1/night-S-L1-W.png': 329962,
	'/textures/im-512/L2/day-N-L2-C.png': 327864,
	'/textures/im-512/L2/day-N-L2-E.png': 218024,
	'/textures/im-512/L2/day-N-L2-W.png': 285857,
	'/textures/im-512/L2/day-S-L2-C.png': 280844,
	'/textures/im-512/L2/day-S-L2-E.png': 217063,
	'/textures/im-512/L2/day-S-L2-W.png': 269651,
	'/textures/im-512/L2/night-N-L2-C.png': 319323,
	'/textures/im-512/L2/night-N-L2-E.png': 242637,
	'/textures/im-512/L2/night-N-L2-W.png': 314904,
	'/textures/im-512/L2/night-S-L2-C.png': 299984,
	'/textures/im-512/L2/night-S-L2-E.png': 234095,
	'/textures/im-512/L2/night-S-L2-W.png': 366964,
}

export interface SceneAssets {
	gltf: GLTF
	env: Texture
	maps: Map<string, Texture>
	imDir: string
}

function expectedBytes( url: string ): number {
	return BYTES[ url.split( '?' )[ 0 ]! ] ?? 0
}

function blobUrl( buffer: ArrayBuffer, type: string ): string {
	return URL.createObjectURL( new Blob( [ buffer ], { type } ) )
}

function createGltfLoader( renderer: KtxRenderer ): GLTFLoader {
	const ktx2 = new KTX2Loader()
	ktx2.setTranscoderPath( BASIS_PATH )
	ktx2.detectSupport( renderer as never )
	const loader = new GLTFLoader()
	loader.setKTX2Loader( ktx2 )
	loader.setMeshoptDecoder( MeshoptDecoder )
	return loader
}

/**
 * 楼模、HDR、室内 PNG 并行拉，进度按字节。
 * 楼模是 meshopt + KTX2，要 renderer 做 Basis 转码。
 */
export async function loadSceneAssets(
	onProgress: ( progress: AssetProgress ) => void,
	renderer: KtxRenderer,
	quality: AssetQuality = 'full',
): Promise<SceneAssets> {

	const imDir = IM_DIR[ quality ]
	const envUrl = ENV_URL[ quality ]
	const imUrls = listInteriorMapUrls( imDir )
	const urls = [ MODEL_URL, envUrl, ...imUrls ]
	const loaded = new Map<string, number>()
	const totals = new Map<string, number>()
	for ( const url of urls ) {
		loaded.set( url, 0 )
		totals.set( url, expectedBytes( url ) )
	}

	const paint = () => {
		let sumL = 0
		let sumT = 0
		for ( const url of urls ) {
			sumL += loaded.get( url ) ?? 0
			sumT += totals.get( url ) ?? 0
		}
		const modelL = loaded.get( MODEL_URL ) ?? 0
		const modelT = totals.get( MODEL_URL ) ?? 1
		const envL = loaded.get( envUrl ) ?? 0
		const envT = totals.get( envUrl ) ?? 1
		let stage = '室内图'
		let stageL = 0
		let stageT = 0
		if ( modelL < modelT ) {
			stage = '楼模'
			stageL = modelL
			stageT = modelT
		} else if ( envL < envT ) {
			stage = '环境贴图'
			stageL = envL
			stageT = envT
		} else {
			for ( const url of imUrls ) {
				stageL += loaded.get( url ) ?? 0
				stageT += totals.get( url ) ?? 0
			}
		}
		onProgress( {
			ratio: sumT > 0 ? Math.min( 1, sumL / sumT ) : 1,
			stage,
			loaded: stageL,
			total: stageT,
		} )
	}

	const mark = ( url: string, n: number, total: number ) => {
		loaded.set( url, n )
		if ( total > 0 ) totals.set( url, total )
		paint()
	}

	const [ modelBuf, envBuf, ...mapBufs ] = await Promise.all( [
		fetchBuffer( MODEL_URL, ( n, t ) => mark( MODEL_URL, n, t ), expectedBytes( MODEL_URL ) ),
		fetchBuffer( envUrl, ( n, t ) => mark( envUrl, n, t ), expectedBytes( envUrl ) ),
		...imUrls.map( ( url ) =>
			fetchBuffer( url, ( n, t ) => mark( url, n, t ), expectedBytes( url ) ),
		),
	] )

	const modelObj = blobUrl( modelBuf, 'model/gltf-binary' )
	const envObj = blobUrl( envBuf, 'application/octet-stream' )
	const gltfLoader = createGltfLoader( renderer )
	try {
		await MeshoptDecoder.ready
		const gltf = await gltfLoader.loadAsync( modelObj )
		const env = await new HDRLoader().loadAsync( envObj )
		env.mapping = EquirectangularReflectionMapping
		env.generateMipmaps = false
		env.needsUpdate = true

		const texLoader = new TextureLoader()
		const maps = new Map<string, Texture>()
		await Promise.all( imUrls.map( async ( url, i ) => {
			const obj = blobUrl( mapBufs[ i ]!, 'image/png' )
			try {
				const tex = await texLoader.loadAsync( obj )
				tex.colorSpace = SRGBColorSpace
				tex.wrapS = ClampToEdgeWrapping
				tex.wrapT = ClampToEdgeWrapping
				tex.anisotropy = 8
				tex.needsUpdate = true
				maps.set( url, tex )
			} finally {
				URL.revokeObjectURL( obj )
			}
		} ) )

		return { gltf, env, maps, imDir }
	} finally {
		gltfLoader.ktx2Loader?.dispose()
		URL.revokeObjectURL( modelObj )
		URL.revokeObjectURL( envObj )
	}

}
