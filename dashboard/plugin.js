/**
 * Android Emulator — live right-side pane in Hermes Desktop
 */

import {
  cn,
  haptic,
  host,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  PALETTE_AREA,
  useQuery,
} from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useState, useRef, useCallback } from 'react'

const ID = 'android-emulator'
const PAGE = '/android-emulator'
const POLL_MS = 3000

function EmulatorPane({ ctx }) {
  const [showLog, setShowLog] = useState(false)
  const [logcat, setLogcat] = useState([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const imgRef = useRef(null)

  const statusQ = useQuery({
    queryKey: ['emu', 'status'],
    queryFn: () => ctx.rest('/status', { timeoutMs: 8000 }),
    refetchInterval: autoRefresh ? POLL_MS : false,
    retry: 0,
    staleTime: 2000,
  })

  const screenQ = useQuery({
    queryKey: ['emu', 'screen'],
    queryFn: () => ctx.rest('/screenshot_b64', { timeoutMs: 10000 }),
    refetchInterval: autoRefresh ? POLL_MS : false,
    retry: 0,
    staleTime: 2000,
  })

  const avdsQ = useQuery({
    queryKey: ['emu', 'avds'],
    queryFn: () => ctx.rest('/avds', { timeoutMs: 8000 }),
    staleTime: 30000,
    retry: 1,
  })

  const status = statusQ.data || {}
  const screen = screenQ.data || {}
  const isOnline = !!status?.online
  const imgSrc = screen?.image || null

  const sendKey = useCallback(async (key) => {
    haptic('tap')
    try { await ctx.rest(`/input/key/${key}`, { timeoutMs: 3000 }) } catch {}
  }, [ctx])

  const sendTap = useCallback(async (x, y) => {
    try { await ctx.rest(`/input/tap/${x}/${y}`, { timeoutMs: 3000 }) } catch {}
  }, [ctx])

  const handleImageClick = (e) => {
    if (!imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    const sw = parseInt(status?.screen_size?.split('x')[0]) || 1080
    const sh = parseInt(status?.screen_size?.split('x')[1]) || 2400
    sendTap(
      Math.round((e.clientX - rect.left) * sw / rect.width),
      Math.round((e.clientY - rect.top) * sh / rect.height)
    )
  }

  const fetchLogcat = async () => {
    try {
      const d = await ctx.rest('/logcat?lines=80', { timeoutMs: 5000 })
      setLogcat(d?.lines || [])
    } catch {}
  }

  let screenContent
  if (!isOnline) {
    screenContent = jsx('div', {
      className: 'flex-1 flex flex-col items-center justify-center gap-2 text-zinc-500',
      children: [
        jsx('div', { key: 'i', className: 'text-3xl', children: '📱' }),
        jsx('div', { key: 'm', className: 'text-sm', children: 'Emulator offline' }),
        jsx('div', { key: 'c', className: 'text-[10px] text-zinc-600', children: 'Run: emu start' }),
      ],
    })
  } else if (!imgSrc) {
    screenContent = jsx('div', {
      className: 'flex-1 flex items-center justify-center text-zinc-500 text-sm',
      children: 'Loading screen...',
    })
  } else {
    screenContent = jsx('div', {
      className: 'relative mx-auto w-full max-w-[200px] rounded-xl overflow-hidden border-2 border-zinc-700 shadow-lg cursor-pointer bg-black',
      children: jsx('img', {
        ref: imgRef,
        src: imgSrc,
        onClick: handleImageClick,
        alt: 'Emulator',
        className: 'w-full block',
        draggable: false,
      }),
    })
  }

  return jsxs('div', {
    className: 'flex h-full flex-col gap-1.5 p-2 text-xs overflow-hidden',
    children: [
      // Status
      jsx('div', {
        className: cn(
          'flex items-center gap-2 rounded-md px-2 py-1 text-[10px] border',
          isOnline ? 'bg-green-950/40 border-green-800/50 text-green-300'
                   : 'bg-zinc-900 border-zinc-700 text-zinc-400'
        ),
        children: jsxs('div', {
          className: 'flex items-center gap-1.5 w-full',
          children: [
            jsx('span', {
              className: cn('h-1.5 w-1.5 rounded-full shrink-0', isOnline ? 'bg-green-400' : 'bg-zinc-500'),
            }),
            jsx('span', {
              children: isOnline
                ? `Android ${status?.android_version || '?'} · SDK ${status?.sdk || '?'}`
                : 'Offline',
            }),
          ],
        }),
      }),

      // AVD Picker toggle
      jsx('button', {
        className: 'flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700/50 transition-colors',
        onClick: () => setShowPicker(!showPicker),
        children: [
          jsx('span', { key: 't', children: `📱 ${avdsQ.data?.avds?.find(a => a.name === 'hermes-test')?.device || 'Device'}` }),
          jsx('span', { key: 'a', className: 'text-zinc-500', children: showPicker ? '▲' : '▼' }),
        ],
      }),

      // AVD Picker panel
      showPicker && jsx('div', {
        className: 'rounded-md border border-zinc-700 bg-zinc-900 p-2 space-y-1.5',
        children: [
          jsx('div', {
            key: 'hdr',
            className: 'text-[10px] text-zinc-400 font-medium mb-1',
            children: 'Installed AVDs',
          }),
          ...(avdsQ.data?.avds || []).map((avd) =>
            jsx('button', {
              key: avd.name,
              className: cn(
                'w-full text-left rounded border px-2 py-1 text-[10px] transition-colors',
                avd.name === 'hermes-test'
                  ? 'border-blue-700 bg-blue-900/30 text-blue-300'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              ),
              onClick: async () => {
                haptic('tap')
                try {
                  await ctx.rest(`/switch/${avd.name}`, { method: 'POST', timeoutMs: 5000 })
                  host.notify({ kind: 'info', message: `Switch to ${avd.name} — run 'emu start'` })
                } catch {}
              },
              children: jsxs('div', {
                className: 'flex justify-between items-center',
                children: [
                  jsx('span', { className: 'font-medium', children: avd.name }),
                  jsx('span', { className: 'text-zinc-500', children: avd.device || '' }),
                ],
              }),
            })
          ),
          jsx('div', {
            key: 'info',
            className: 'text-[9px] text-zinc-500 pt-1 border-t border-zinc-800',
            children: 'Switch AVDs from CLI: emu stop && emu start <name>',
          }),
        ],
      }),

      // Screen
      screenContent,

      // Nav
      jsx('div', {
        className: 'grid grid-cols-4 gap-1.5',
        children: [
          ['🔙', 'Back', 'BACK'],
          ['🏠', 'Home', 'HOME'],
          ['📋', 'Recent', 'APP_SWITCH'],
          ['⏻', 'Power', 'POWER'],
        ].map(([icon, label, key]) =>
          jsx('button', {
            key,
            className: 'flex flex-col items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 text-[10px] text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 transition-colors',
            onClick: () => sendKey(key),
            children: [
              jsx('span', { key: 'i', className: 'text-base leading-none', children: icon }),
              jsx('span', { key: 'l', children: label }),
            ],
          })
        ),
      }),

      // Controls
      jsx('div', {
        className: 'flex gap-1.5 justify-between',
        children: [
          jsx('button', {
            key: 'r',
            className: cn(
              'flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors',
              autoRefresh ? 'border-blue-700 bg-blue-900/50 text-blue-300 hover:bg-blue-800/50'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            ),
            onClick: () => setAutoRefresh(!autoRefresh),
            children: autoRefresh ? '⏸ Pause' : '▶ Live',
          }),
          jsx('button', {
            key: 'l',
            className: cn(
              'flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors',
              showLog ? 'border-amber-700 bg-amber-900/50 text-amber-300 hover:bg-amber-800/50'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            ),
            onClick: () => { fetchLogcat(); setShowLog(!showLog) },
            children: showLog ? '📜 Hide Log' : '📜 Logcat',
          }),
        ],
      }),

      // Logcat
      showLog && jsx('div', {
        className: 'flex-1 min-h-0 overflow-auto rounded bg-zinc-950 border border-zinc-800 p-1 font-mono text-[9px] leading-relaxed',
        children: logcat.length === 0
          ? jsx('div', { className: 'text-zinc-600', children: 'No output' })
          : logcat.map((line, i) =>
            jsx('div', {
              key: i,
              className: cn(
                'whitespace-pre-wrap break-all',
                line.includes(' E ') ? 'text-red-400'
                  : line.includes(' W ') ? 'text-amber-400'
                  : line.includes(' I ') ? 'text-green-400'
                  : 'text-zinc-500'
              ),
              children: line,
            })
          ),
      }),

      // Footer
      isOnline && status?.screen_size && jsx('div', {
        className: 'text-center text-[9px] text-zinc-600',
        children: `${status.screen_size}`,
      }),
    ],
  })
}

export default {
  id: ID,
  name: 'Android Emulator',
  defaultEnabled: true,
  register(ctx) {
    ctx.registerMany([
      {
        id: 'pane',
        area: 'panes',
        title: 'Emulator',
        data: { placement: 'right', width: '230px' },
        render: () => jsx(EmulatorPane, { ctx }),
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        data: { path: PAGE, label: 'Emulator', codicon: 'device-mobile' },
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: `${ID}.open`,
          label: 'Open Android Emulator',
          keywords: ['android', 'emulator', 'phone', 'device'],
          run: () => host.navigate(PAGE),
        },
      },
    ])
  },
}
