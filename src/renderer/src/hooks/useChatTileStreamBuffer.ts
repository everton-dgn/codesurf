import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ChatMessage } from '../../../shared/chat-types'
import { normalizeMessagesForMemory } from '../components/chat/messageNormalization'
import { CHAT_STREAM_FLUSH_INTERVAL_MS } from '../components/chat/largeContent'

export function useChatTileStreamBuffer(options: {
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  pagedLinkedHistoryEnabled: boolean
  isStreaming: boolean
}) {
  const { setMessages, pagedLinkedHistoryEnabled, isStreaming } = options
  const pagedLinkedHistoryEnabledRef = useRef(pagedLinkedHistoryEnabled)
  pagedLinkedHistoryEnabledRef.current = pagedLinkedHistoryEnabled
  const isStreamingRef = useRef(false)
  const pendingStreamTextRef = useRef('')
  const pendingStreamFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setMessagesSafe = useCallback((updater: React.SetStateAction<ChatMessage[]>) => {
    setMessages(prev => {
      const next = typeof updater === 'function'
        ? (updater as (prev: ChatMessage[]) => ChatMessage[])(prev)
        : updater
      if (pagedLinkedHistoryEnabledRef.current) return next
      if (isStreamingRef.current && next.length === prev.length && next[next.length - 1]?.isStreaming) {
        return next
      }
      return normalizeMessagesForMemory(next)
    })
  }, [setMessages])

  const flushPendingStreamText = useCallback(() => {
    const text = pendingStreamTextRef.current
    if (!text) return
    pendingStreamTextRef.current = ''
    setMessagesSafe(prev => {
      const last = prev[prev.length - 1]
      if (!last?.isStreaming) return prev
      const blocks = [...(last.contentBlocks ?? [])]
      const lastBlock = blocks[blocks.length - 1]
      if (lastBlock?.type === 'text') {
        blocks[blocks.length - 1] = { ...lastBlock, text: lastBlock.text + text }
      } else {
        blocks.push({ type: 'text', text })
      }
      return [...prev.slice(0, -1), { ...last, content: last.content + text, contentBlocks: blocks }]
    })
  }, [setMessagesSafe])

  const queueStreamText = useCallback((text: string) => {
    if (!text) return
    pendingStreamTextRef.current += text
    if (pendingStreamFlushTimerRef.current) return
    pendingStreamFlushTimerRef.current = setTimeout(() => {
      pendingStreamFlushTimerRef.current = null
      flushPendingStreamText()
    }, CHAT_STREAM_FLUSH_INTERVAL_MS)
  }, [flushPendingStreamText])

  useEffect(() => () => {
    if (pendingStreamFlushTimerRef.current) {
      clearTimeout(pendingStreamFlushTimerRef.current)
      pendingStreamFlushTimerRef.current = null
    }
    pendingStreamTextRef.current = ''
  }, [])

  useEffect(() => {
    isStreamingRef.current = isStreaming
  }, [isStreaming])

  return {
    isStreamingRef,
    setMessagesSafe,
    queueStreamText,
    flushPendingStreamText,
  }
}