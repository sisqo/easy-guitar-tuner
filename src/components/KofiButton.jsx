import { useEffect, useRef } from 'react'

export default function KofiButton() {
  const ref = useRef(null)

  useEffect(() => {
    function render() {
      if (!window.kofiwidget2 || !ref.current) return
      window.kofiwidget2.init('Buy me a coffee', '#72a4f2', 'W0A422BZTW')
      ref.current.innerHTML = window.kofiwidget2.getHTML()
    }

    if (window.kofiwidget2) {
      render()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://storage.ko-fi.com/cdn/widget/Widget_2.js'
    script.onload = render
    document.head.appendChild(script)
  }, [])

  return <div ref={ref} className="flex justify-center pb-4" />
}
