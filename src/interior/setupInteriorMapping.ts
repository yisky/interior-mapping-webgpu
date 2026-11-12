import {
	BufferAttribute,
	Mesh,
	Vector3,
	type BufferGeometry,
	type Material,
	type Object3D,
	type PointLight,
	type Texture,
} from 'three'
import type { SunLight } from 'three/addons/lights/SunLight.js'
import type { Period } from '../scene/dayNight'
import { isGlassMesh } from '../scene/glass'
import { createInteriorMaterial } from './createInteriorMaterial'
import { attachWindowLight } from './createWindowLight'
import { setWindowLightsAmount } from './windowLights'

export const IM_DIR = {
	full: '/textures/im',
	lite: '/textures/im-512',
} as const

/** 按窗名挂日/夜 PNG。L0/L1/L2 对应文件夹。南面一层中间是门，没有 C。 */
function mapUrlForGlass( name: string, period: Period, imDir: string = IM_DIR.full ): string | null {
	const m = /Glass_IM_([NS])_L(\d)_B(\d)/.exec( name )
	if ( m === null ) return null
	const floor = m[ 2 ]
	if ( floor !== '0' && floor !== '1' && floor !== '2' ) return null
	const slot = m[ 3 ] === '0' ? 'W' : m[ 3 ] === '1' ? 'C' : m[ 3 ] === '2' ? 'E' : null
	if ( slot === null ) return null
	if ( m[ 1 ] === 'S' && floor === '0' && slot === 'C' ) return null
	return `${ imDir }/L${ floor }/${ period }-${ m[ 1 ] }-L${ floor }-${ slot }.png?v=dn1`
}

/** 日夜 × 南北 × 三槽，去掉南门那扇。给加载器按字节预登记。 */
export function listInteriorMapUrls( imDir: string = IM_DIR.full ): string[] {
	const urls: string[] = []
	for ( const floor of [ '0', '1', '2' ] ) {
		for ( const period of [ 'day', 'night' ] as const ) {
			for ( const side of [ 'N', 'S' ] as const ) {
				for ( const slot of [ 'W', 'C', 'E' ] as const ) {
					const b = slot === 'W' ? '0' : slot === 'C' ? '1' : '2'
					const url = mapUrlForGlass( `Glass_IM_${ side }_L${ floor }_B${ b }`, period, imDir )
					if ( url !== null ) urls.push( url )
				}
			}
		}
	}
	return urls
}

export interface InteriorMappingHandle {
	enabled: boolean
	period: Period
	windowLights: boolean
	setEnabled: ( on: boolean ) => void
	setPeriod: ( period: Period ) => void
	setWindowLights: ( on: boolean ) => void
	dispose: () => void
}

interface GlassBinding {
	mesh: Mesh
	originals: Material[]
	dayMats: Material[]
	nightMats: Material[]
	light: PointLight | null
}

function disposePack( env: Texture, maps: Map<string, Texture> ) {
	for ( const tex of maps.values() ) tex.dispose()
	env.dispose()
}

/**
 * 按玻璃网格名挂已加载的日/夜 PNG。
 */
export function setupInteriorMapping(
	root: Object3D,
	sun: SunLight | null | undefined,
	pack: { env: Texture, maps: Map<string, Texture>, imDir?: string },
): InteriorMappingHandle {
	const { env, maps } = pack
	const imDir = pack.imDir ?? IM_DIR.full
	const meshes = collectGlassMeshes( root ).filter( ( mesh ) => {
		const name = mesh.name || normalizeMaterials( mesh.material )[ 0 ]?.name || ''
		return mapUrlForGlass( name, 'day', imDir ) !== null
	} )
	if ( meshes.length === 0 ) {
		return {
			enabled: false,
			period: 'day',
			windowLights: true,
			setEnabled() {},
			setPeriod() {},
			setWindowLights() {},
			dispose() {
				disposePack( env, maps )
			},
		}
	}

	const materials = new Map<string, ReturnType<typeof createInteriorMaterial>>()

	function materialFor( url: string, period: Period ) {
		const key = `${ url }|${ env.uuid }|${ period }`
		let mat = materials.get( key )
		if ( mat !== undefined ) return mat
		const tex = maps.get( url )
		if ( tex === undefined ) throw new Error( `[im] 缺图 ${ url }` )
		mat = createInteriorMaterial( tex, env, period, period === 'day' ? sun : null )
		materials.set( key, mat )
		return mat
	}

	const bindings: GlassBinding[] = []
	for ( const mesh of meshes ) {
		const originals = normalizeMaterials( mesh.material ).slice()
		const glassName = mesh.name || originals[ 0 ]?.name || ''
		const dayUrl = mapUrlForGlass( glassName, 'day', imDir )
		const nightUrl = mapUrlForGlass( glassName, 'night', imDir )
		if ( dayUrl === null || nightUrl === null ) continue
		mesh.geometry = mesh.geometry.clone()
		bakeRoomAttributes( mesh, glassName )
		const dayMat = materialFor( dayUrl, 'day' )
		const nightMat = materialFor( nightUrl, 'night' )
		bindings.push( {
			mesh,
			originals,
			dayMats: originals.map( () => dayMat ),
			nightMats: originals.map( () => nightMat ),
			light: attachWindowLight( mesh ),
		} )
	}

	function apply() {
		const lightsOn = handle.enabled && handle.period === 'night' && handle.windowLights
		setWindowLightsAmount( lightsOn )
		for ( const { mesh, originals, dayMats, nightMats, light } of bindings ) {
			const im = handle.period === 'night' ? nightMats : dayMats
			const list = handle.enabled ? im : originals
			mesh.material = list.length === 1 ? list[ 0 ]! : list
			if ( light !== null ) light.visible = lightsOn
		}
	}

	const handle: InteriorMappingHandle = {
		enabled: false,
		period: 'day',
		windowLights: true,
		setEnabled( on ) {
			handle.enabled = on
			apply()
		},
		setPeriod( period ) {
			handle.period = period
			apply()
		},
		setWindowLights( on ) {
			handle.windowLights = on
			apply()
		},
		dispose() {
			handle.setEnabled( false )
			for ( const { light } of bindings ) light?.removeFromParent()
			for ( const mat of materials.values() ) mat.dispose()
			disposePack( env, maps )
		},
	}
	handle.setEnabled( true )
	return handle
}

function collectGlassMeshes( root: Object3D ): Mesh[] {
	const meshes: Mesh[] = []
	root.traverse( ( obj ) => {
		if ( ( obj as Mesh ).isMesh === true && isGlassMesh( obj as Mesh ) ) meshes.push( obj as Mesh )
	} )
	return meshes
}

/** 朝外法线：S=+Z N=-Z E=+X W=-X。 */
function parseOutward( name: string ): Vector3 | null {
	const m = /Glass_IM_([NSEW])_/.exec( name )
	if ( m === null ) return null
	if ( m[ 1 ] === 'N' ) return new Vector3( 0, 0, -1 )
	if ( m[ 1 ] === 'S' ) return new Vector3( 0, 0, 1 )
	if ( m[ 1 ] === 'E' ) return new Vector3( 1, 0, 0 )
	if ( m[ 1 ] === 'W' ) return new Vector3( -1, 0, 0 )
	return null
}

function normalizeMaterials( material: Material | Material[] ): Material[] {
	return Array.isArray( material ) ? material : [ material ]
}

/**
 * 外表面中心 + 开间宽高 + 朝外法线。宽度取垂直于朝向外法线的那条水平边，不看 verts[0]。
 */
function bakeRoomAttributes( mesh: Mesh, matName: string ): void {
	const geom = mesh.geometry as BufferGeometry
	const pos = geom.getAttribute( 'position' )
	const n = parseOutward( matName )
	if ( n === null ) return

	const v = new Vector3()
	let minX = Infinity, minY = Infinity, minZ = Infinity
	let maxX = - Infinity, maxY = - Infinity, maxZ = - Infinity
	for ( let i = 0; i < pos.count; i ++ ) {
		v.fromBufferAttribute( pos, i )
		minX = Math.min( minX, v.x ); maxX = Math.max( maxX, v.x )
		minY = Math.min( minY, v.y ); maxY = Math.max( maxY, v.y )
		minZ = Math.min( minZ, v.z ); maxZ = Math.max( maxZ, v.z )
	}
	const c = new Vector3( ( minX + maxX ) * 0.5, ( minY + maxY ) * 0.5, ( minZ + maxZ ) * 0.5 )
	const size = new Vector3( maxX - minX, maxY - minY, maxZ - minZ )
	const thin = Math.abs( n.x ) > 0.5 ? size.x : size.z
	c.addScaledVector( n, thin * 0.5 )

	const up = new Vector3( 0, 1, 0 )
	const uAxis = new Vector3().crossVectors( up, n ).normalize()
	const sizeU = Math.abs( uAxis.x ) > 0.5 ? size.x : size.z
	const sizeV = size.y

	const roomCenter = new Float32Array( pos.count * 3 )
	const roomSize = new Float32Array( pos.count * 2 )
	const roomNormal = new Float32Array( pos.count * 3 )
	for ( let i = 0; i < pos.count; i ++ ) {
		roomCenter[ i * 3 ] = c.x
		roomCenter[ i * 3 + 1 ] = c.y
		roomCenter[ i * 3 + 2 ] = c.z
		roomSize[ i * 2 ] = sizeU
		roomSize[ i * 2 + 1 ] = sizeV
		roomNormal[ i * 3 ] = n.x
		roomNormal[ i * 3 + 1 ] = n.y
		roomNormal[ i * 3 + 2 ] = n.z
	}
	geom.setAttribute( 'roomCenter', new BufferAttribute( roomCenter, 3 ) )
	geom.setAttribute( 'roomSize', new BufferAttribute( roomSize, 2 ) )
	geom.setAttribute( 'roomNormal', new BufferAttribute( roomNormal, 3 ) )
}
