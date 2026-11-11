import { PointLight, Vector3, type BufferGeometry, type Mesh } from 'three'

/** 贴在窗口外侧一点点：砖还能吃到光，又不像街灯从外往里打。 */
const LIFT = 0.01

/**
 * 窗内点光，不开阴影。
 */
export function attachWindowLight( glass: Mesh ): PointLight | null {
	const geom = glass.geometry as BufferGeometry
	const rc = geom.getAttribute( 'roomCenter' )
	const rn = geom.getAttribute( 'roomNormal' )
	if ( rc === undefined || rn === undefined ) return null

	const n = new Vector3( rn.getX( 0 ), rn.getY( 0 ), rn.getZ( 0 ) )
	if ( n.lengthSq() < 0.5 ) return null
	n.normalize()

	const light = new PointLight( 0xffd2a0, 5, 3.2, 2 )
	light.name = `WinLight_${ glass.name }`
	light.castShadow = false
	light.visible = false
	light.position.set( rc.getX( 0 ), rc.getY( 0 ), rc.getZ( 0 ) ).addScaledVector( n, LIFT )
	glass.add( light )
	return light
}
