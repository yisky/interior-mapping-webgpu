import { useEffect, useRef } from 'react'
import {
	Box3,
	HemisphereLight,
	Mesh,
	NoToneMapping,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	Vector3,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js'
import { SunLight } from 'three/addons/lights/SunLight.js'
import { SunLightNode } from 'three/addons/lights/SunLightNode.js'
import { sunShadow } from 'three/addons/lights/SunShadowNode.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { materialOpacity, oneMinus } from 'three/tsl'
import { MeshBasicNodeMaterial, WebGPURenderer } from 'three/webgpu'
import { setupInteriorMapping } from './interior/setupInteriorMapping'
import { createPostPipeline } from './post/createPostPipeline'
import { createCourtLights } from './scene/createCourtLights'
import { createDoorLight } from './scene/createDoorLight'
import { createDayNightLook } from './scene/dayNight'
import { markBuildingShadows, setupPhysicalGlass } from './scene/glass'
import { createFps } from './ui/fps'
import { createToolbar } from './ui/createToolbar'

type StudioScene = Scene & { backgroundNode?: unknown, environment?: unknown }

/**
 * 展陈场景：楼模 + 日夜预设（背景、太阳、半球光、窗图）。右下角日夜 / IM 开关。
 */
export default function App() {
	const hostRef = useRef<HTMLDivElement | null>( null )

	useEffect( () => {
		const maybeHost = hostRef.current
		if ( maybeHost === null ) return
		const hostEl: HTMLDivElement = maybeHost

		let disposed = false
		let renderer: WebGPURenderer | undefined
		let frame = 0
		let controls: OrbitControls | undefined
		let cleanupExtras: () => void = () => {}
		const fps = createFps()
		let togglesDispose = () => {}

		async function boot(): Promise<() => void> {
			renderer = new WebGPURenderer( { antialias: true } )
			SunLight.registerNode( SunLightNode )
			renderer.lighting = new ClusteredLighting( 32 )
			await renderer.init()
			if ( disposed ) {
				renderer.dispose()
				return () => {}
			}

			renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) )
			renderer.setSize( hostEl.clientWidth, hostEl.clientHeight )
			renderer.toneMapping = NoToneMapping
			renderer.toneMappingExposure = 1
			renderer.shadowMap.enabled = true
			renderer.info.autoReset = false
			hostEl.appendChild( renderer.domElement )

			const scene = new Scene() as StudioScene
			const camera = new PerspectiveCamera(
				40,
				hostEl.clientWidth / Math.max( hostEl.clientHeight, 1 ),
				0.1,
				120,
			)

			const gltf = await new GLTFLoader().loadAsync( '/models/studio_3f_im.glb' )
			if ( disposed ) {
				gltf.scene.removeFromParent()
				return () => {}
			}
			const building = gltf.scene
			const box = new Box3().setFromObject( building )
			building.position.y -= box.min.y
			box.setFromObject( building )
			const size = box.getSize( new Vector3() )
			const center = box.getCenter( new Vector3() )
			markBuildingShadows( building )
			setupPhysicalGlass( building )

			const hemi = new HemisphereLight( 0xe8dcc8, 0x6a645c, 0.55 )
			scene.add( hemi )
			const sun = new SunLight( 0xfff6ee, 5.6 )
			sun.position.set( -0.75, 1.2, 0.65 )
			sun.castShadow = true
			sun.shadow.mapSize.setScalar( 2048 )
			sun.shadow.camera.far = 80
			sun.shadow.normalBias = 0.04
			scene.add( sun )

			const interior = await setupInteriorMapping( building, sun )
			if ( disposed ) {
				interior.dispose()
				return () => {}
			}
			scene.add( building )

			const fit = ( 0.5 * Math.max( size.x, size.y, size.z ) ) / Math.tan( camera.fov * Math.PI / 360 )
			const dist = fit * 1.42
			camera.position.set(
				center.x,
				center.y + dist * 0.28,
				center.z + dist * 0.78,
			)
			controls = new OrbitControls( camera, renderer.domElement )
			controls.enableDamping = false
			controls.target.copy( center )
			//controls.maxPolarAngle = Math.PI * 0.49
			controls.minDistance = 8
			controls.maxDistance = 160
			controls.update()

			const groundMat = new MeshBasicNodeMaterial( {
				color: 0x5c6570,
				opacity: 0.28,
				transparent: true,
			} )
			groundMat.opacityNode = materialOpacity.mul( oneMinus( sunShadow( sun ) as never ) )
			const ground = new Mesh( new PlaneGeometry( 400, 400 ), groundMat )
			ground.rotation.x = - Math.PI / 2
			ground.receiveShadow = true
			ground.name = 'Ground'
			scene.add( ground )

			const post = createPostPipeline( { renderer, scene, camera } )
			const look = createDayNightLook( { renderer, scene, hemi, sun, ground } )
			const courtLights = createCourtLights( building )
			const doorLight = createDoorLight( building )
			const toolbar = createToolbar( {
				period: 'day',
				imEnabled: true,
				windowLights: true,
				onPeriod: ( period ) => {
					look.setPeriod( period )
					interior.setPeriod( period )
					courtLights.setPeriod( period )
					doorLight.setPeriod( period )
					post.setPeriod( period )
				},
				onIm: ( on ) => interior.setEnabled( on ),
				onWindowLights: ( on ) => interior.setWindowLights( on ),
			} )
			togglesDispose = () => {
				toolbar.dispose()
				interior.dispose()
				courtLights.dispose()
				doorLight.dispose()
				post.dispose()
			}

			const onResize = () => {
				const w = hostEl.clientWidth
				const h = Math.max( hostEl.clientHeight, 1 )
				camera.aspect = w / h
				camera.updateProjectionMatrix()
				renderer!.setSize( w, h )
				post.resize( w, h )
			}
			window.addEventListener( 'resize', onResize )
			onResize()

			let lastMs = performance.now()
			const tick = () => {
				frame = requestAnimationFrame( tick )
				if ( disposed ) return
				const now = performance.now()
				const dt = Math.min( 0.05, ( now - lastMs ) / 1000 )
				lastMs = now
				renderer!.info.reset()
				controls?.update()
				post.render()
				fps.frame( dt * 1000, renderer!.info.render.drawCalls )
			}
			tick()

			let cleaned = false
			const cleanup = () => {
				if ( cleaned ) return
				cleaned = true
				cancelAnimationFrame( frame )
				window.removeEventListener( 'resize', onResize )
				controls?.dispose()
				scene.remove( building )
				scene.remove( ground )
				ground.geometry.dispose()
				ground.material.dispose()
			}

			cleanupExtras = cleanup
			return cleanup
		}

		let cleanupInner: () => void = () => {}
		boot()
			.then( ( fn ) => {
				cleanupInner = fn
			} )
			.catch( ( err: unknown ) => {
				console.error( '[interior-mapping-webgpu] 启动失败', err )
				hostEl.textContent = 'WebGPU / 场景初始化失败 · 请看控制台。'
			} )

		return () => {
			disposed = true
			fps.dispose()
			togglesDispose()
			cleanupInner()
			cleanupExtras()
			if ( renderer ) {
				renderer.dispose()
				if ( renderer.domElement.parentNode === hostEl ) {
					hostEl.removeChild( renderer.domElement )
				}
			}
		}
	}, [] )

	return (
		<div ref={hostRef} style={{ width: '100%', height: '100%' }} />
	)
}

