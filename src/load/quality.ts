export type AssetQuality = 'full' | 'lite'

type NavigatorWithHints = Navigator & {
	userAgentData?: { mobile: boolean }
	connection?: { saveData?: boolean }
}

/**
 * 档位只在启动时选一次：手机/平板走 512，Save-Data 也走 512。
 * 不用窗口宽度（桌面窗口化和全屏会变）。
 */
export function pickAssetQuality(): AssetQuality {

	const nav = navigator as NavigatorWithHints
	if ( nav.connection?.saveData === true ) return 'lite'
	if ( isMobileClient( nav ) ) return 'lite'
	return 'full'

}

/**
 * Chromium：UA Client Hints 的 mobile。
 * 其余：MDN 的 Mobi；再补 iPhone/iPad、iPadOS 伪装成 Mac、安卓平板（有 Android 无 Mobile）。
 */
function isMobileClient( nav: NavigatorWithHints ): boolean {

	if ( nav.userAgentData?.mobile === true ) return true

	const ua = nav.userAgent

	if ( /Mobi/i.test( ua ) ) return true
	if ( /iPhone|iPod|iPad/i.test( ua ) ) return true
	if ( /Macintosh/i.test( ua ) && nav.maxTouchPoints > 1 ) return true
	if ( /Android/i.test( ua ) ) return true

	return false

}
