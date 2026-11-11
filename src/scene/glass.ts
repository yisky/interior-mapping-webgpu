import { Mesh, MeshPhysicalMaterial, type Object3D } from 'three'

/** 玻璃节点 / 半透窗片。 */
export function isGlassMesh( mesh: Mesh ): boolean {
	if ( mesh.name.includes( 'Court_LampShade' ) ) return false
	if ( mesh.name.includes( 'Door_CanopyLight' ) ) return false
	if ( mesh.name.includes( 'Glass' ) ) return true
	if ( mesh.parent?.name.includes( 'Glass' ) ) return true
	const materials = Array.isArray( mesh.material ) ? mesh.material : [ mesh.material ]
	return materials.some( ( mat ) => {
		if ( mat.name.includes( 'Glass' ) ) return true
		const anyMat = mat as { transparent?: boolean, opacity?: number, transmission?: number }
		if ( anyMat.transparent === true ) return true
		if ( typeof anyMat.opacity === 'number' && anyMat.opacity < 0.99 ) return true
		if ( typeof anyMat.transmission === 'number' && anyMat.transmission > 0.01 ) return true
		return false
	} )
}

/** 混凝土 / 窗框投阴影并接影；玻璃只跳过投影。 */
export function markBuildingShadows( root: Object3D ): void {
	root.traverse( ( obj ) => {
		if ( ( obj as Mesh ).isMesh !== true ) return
		const mesh = obj as Mesh
		const glass = isGlassMesh( mesh )
		mesh.castShadow = ! glass
		mesh.receiveShadow = ! glass
	} )
}

/**
 * Interior Mapping 关闭时的物理玻璃：opacity 1 + 透射，靠菲涅尔看见窗面。
 */
export function setupPhysicalGlass( root: Object3D ): void {
	root.traverse( ( obj ) => {
		if ( ( obj as Mesh ).isMesh !== true ) return
		const mesh = obj as Mesh
		if ( ! isGlassMesh( mesh ) ) return
		const mats = Array.isArray( mesh.material ) ? mesh.material : [ mesh.material ]
		for ( const mat of mats ) {
			const glass = mat as MeshPhysicalMaterial
			if ( glass.isMeshPhysicalMaterial !== true && glass.type !== 'MeshPhysicalMaterial' ) continue
			glass.opacity = 1
			glass.transparent = true
			glass.transmission = 0.96
			glass.thickness = 0.08
			glass.ior = 1.5
			glass.roughness = 0.05
			glass.metalness = 0
			glass.envMapIntensity = 2.2
			glass.specularIntensity = 1
			glass.color.setRGB( 0.82, 0.88, 0.93 )
			glass.needsUpdate = true
		}
	} )
}
