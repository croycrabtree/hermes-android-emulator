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
    queryKey: ['emu', 'picker'],
    queryFn: () => ctx.rest('/picker', { timeoutMs: 30000 }),
    staleTime: 60000,
    retry: 1,
  })

  const status = statusQ.data || {}
  const screen = screenQ.data || {}
  const picker = avdsQ.data || {}
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
        jsx('div', { key: 'c', className: 'text-xs text-zinc-600', children: 'Run: emu start' }),
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
          'flex items-center gap-2 rounded-md px-2 py-1 text-xs border',
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
        className: 'flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700/50 transition-colors',
        onClick: () => setShowPicker(!showPicker),
        children: [
          jsx('span', { key: 't', children: `📱 ${picker?.active_avd || 'Device'}` }),
          jsx('span', { key: 'a', className: 'text-zinc-500', children: showPicker ? '▲' : '▼' }),
        ],
      }),

      // AVD Picker panel
      showPicker && jsx('div', {
        className: 'rounded-md border border-zinc-700 bg-zinc-900 p-2 space-y-2 max-h-[400px] overflow-y-auto',
        children: [
          // Installed AVDs
          jsx('div', { key: 'h1', className: 'text-xs text-zinc-400 font-medium', children: 'Installed AVDs' }),
          ...(picker?.avds || []).map((avd) =>
            jsx('button', {
              key: avd.name,
              className: cn(
                'w-full text-left rounded border px-2 py-1.5 text-xs transition-colors',
                avd.name === picker?.active_avd
                  ? 'border-blue-700 bg-blue-900/30 text-blue-300'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              ),
              onClick: () => {
                haptic('tap')
                host.notify({ kind: 'info', message: `Run: emu stop && emu start ${avd.name}` })
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

          // Device profiles
          jsx('div', { key: 'h2', className: 'text-xs text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: '📱 Devices' }),
          jsx('div', {
            key: 'devlist',
            className: 'grid grid-cols-2 gap-1',
            children: (picker?.devices || []).map((dev) =>
              jsx('button', {
                key: dev.id,
                className: 'text-left rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors truncate',
                onClick: async () => {
                  haptic('tap')
                  const name = `avd-${dev.id}`
                  try {
                    const r = await ctx.rest(`/create?name=${name}&device=${dev.id}&api=34`, { method: 'POST', timeoutMs: 60000 })
                    if (r?.ok) {
                      host.notify({ kind: 'success', message: `Created ${name}! Run: emu start ${name}` })
                    } else {
                      host.notify({ kind: 'error', message: r?.error || 'Failed' })
                    }
                  } catch { host.notify({ kind: 'error', message: 'Request failed' }) }
                },
                children: dev.name || dev.id,
              })
            ),
          }),

          // Android versions (installed + available)
          jsx('div', { key: 'h3', className: 'text-xs text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: '🤖 Android Versions' }),
          jsx('div', {
            key: 'apilist',
            className: 'flex flex-wrap gap-1',
            children: [
              ...(picker?.installed_images || []).map((img) =>
                jsx('span', {
                  key: img.package,
                  className: 'rounded-full border border-green-700 bg-green-900/30 px-2 py-0.5 text-xs text-green-300',
                  children: `API ${img.api} ✓`,
                })
              ),
              ...(picker?.available_images || []).map((img) =>
                jsx('button', {
                  key: img.package,
                  className: 'rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors',
                  onClick: async () => {
                    haptic('tap')
                    host.notify({ kind: 'info', message: `Installing API ${img.api}... this takes a minute` })
                    try {
                      const r = await ctx.rest(`/create?name=api${img.api}-test&device=pixel_6&api=${img.api}`, { method: 'POST', timeoutMs: 300000 })
                      if (r?.ok) {
                        host.notify({ kind: 'success', message: `Installed API ${img.api}! AVD created.` })
                      } else {
                        host.notify({ kind: 'error', message: r?.error || 'Install failed' })
                      }
                    } catch { host.notify({ kind: 'error', message: 'Request failed' }) }
                  },
                  children: `API ${img.api}`,
                })
              ),
            ],
          }),

          jsx('div', {
            key: 'info',
            className: 'text-xs text-zinc-500 pt-1 border-t border-zinc-800',
            children: 'Green = installed · Gray = click to install · Click AVD to switch',
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
            className: 'flex flex-col items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 transition-colors',
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
              'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
              autoRefresh ? 'border-blue-700 bg-blue-900/50 text-blue-300 hover:bg-blue-800/50'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            ),
            onClick: () => setAutoRefresh(!autoRefresh),
            children: autoRefresh ? '⏸ Pause' : '▶ Live',
          }),
          jsx('button', {
            key: 'l',
            className: cn(
              'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
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
        className: 'flex-1 min-h-0 overflow-auto rounded bg-zinc-950 border border-zinc-800 p-1 font-mono text-xs leading-relaxed',
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
        className: 'text-center text-xs text-zinc-600',
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
