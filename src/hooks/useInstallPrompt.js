import { useState, useEffect } from 'react'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    setIsStandalone(standalone)

    const ua = window.navigator.userAgent
    // iOS WebKit but not Chrome for iOS (CriOS can't install PWAs)
    const ios = /iphone|ipad|ipod/i.test(ua) && /WebKit/i.test(ua) && !/CriOS/i.test(ua)
    setIsIOS(ios)

    function handleBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  async function install() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
    return outcome === 'accepted'
  }

  const canInstall = !!deferredPrompt
  // Show option if not already installed AND (native prompt available OR iOS manual)
  const showInstallOption = !isStandalone && (canInstall || isIOS)

  return { canInstall, isIOS, showInstallOption, install }
}
