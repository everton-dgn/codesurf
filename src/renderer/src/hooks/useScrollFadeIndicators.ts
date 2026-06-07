import { useEffect } from 'react'

const SCROLL_FADE_SELECTOR = '.cs-fade-scroll-y, [data-scroll-fade="y"], [style*="overflow-y: auto"], [style*="overflow: auto"]'

/** Toggle `data-scroll-fade-active` on scrollable elements for edge fade masks. */
export function useScrollFadeIndicators(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return

    let raf = 0
    const updateScrollFades = () => {
      raf = 0
      document.querySelectorAll<HTMLElement>(SCROLL_FADE_SELECTOR).forEach(el => {
        if (el.dataset.scrollFade === 'none') {
          el.removeAttribute('data-scroll-fade-active')
          return
        }
        const style = window.getComputedStyle(el)
        const canScrollY = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay'
        const needsFade = canScrollY && el.clientHeight > 0 && el.scrollHeight - el.clientHeight > 2
        if (needsFade) {
          if (el.getAttribute('data-scroll-fade-active') !== 'true') el.setAttribute('data-scroll-fade-active', 'true')
        } else if (el.hasAttribute('data-scroll-fade-active')) {
          el.removeAttribute('data-scroll-fade-active')
        }
      })
    }
    const scheduleUpdate = () => {
      if (raf) return
      raf = window.requestAnimationFrame(updateScrollFades)
    }
    scheduleUpdate()
    const mutationObserver = new MutationObserver(scheduleUpdate)
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-scroll-fade', 'data-scroll-fade-active'],
    })
    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(document.documentElement)
    window.addEventListener('resize', scheduleUpdate)
    const interval = window.setInterval(scheduleUpdate, 1000)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      window.clearInterval(interval)
    }
  }, [])
}