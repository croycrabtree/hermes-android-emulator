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
  Tip,
} from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useState, useRef, useCallback, useEffect } from 'react'

const ID = 'android-emulator'
const PAGE = '/android-emulator'
const POLL_MS = 3000
let _setVisible = null

function EmulatorPane({ ctx }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => { _setVisible = setVisible }, [])
  const [showLog, setShowLog] = useState(false)
  const [logcat, setLogcat] = useState([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [showApps, setShowApps] = useState(false)
  const [apps, setApps] = useState([])
  const [textInput, setTextInput] = useState('')
  const [showTools, setShowTools] = useState(false)
  const [shellCmd, setShellCmd] = useState('')
  const [shellOut, setShellOut] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [gallery, setGallery] = useState([])
  const [showGallery, setShowGallery] = useState(false)
  const [gpsLat, setGpsLat] = useState('37.7749')
  const [gpsLng, setGpsLng] = useState('-122.4194')
  const [batteryLevel, setBatteryLevel] = useState(100)
  const [deeplinkUrl, setDeeplinkUrl] = useState('')
  const [notifTitle, setNotifTitle] = useState('Test')
  const [notifBody, setNotifBody] = useState('From Hermes')
  const [isRecording, setIsRecording] = useState(false)
  const [testOutput, setTestOutput] = useState('')
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

  const sendSwipe = useCallback(async (dir) => {
    haptic('tap')
    try { await ctx.rest(`/swipe/${dir}`, { method: 'POST', timeoutMs: 3000 }) } catch {}
  }, [ctx])

  const fetchApps = useCallback(async () => {
    try {
      const d = await ctx.rest('/apps', { timeoutMs: 10000 })
      setApps(d?.apps || [])
    } catch {}
  }, [ctx])

  const launchApp = useCallback(async (pkg) => {
    haptic('tap')
    try {
      await ctx.rest(`/apps/launch?package=${encodeURIComponent(pkg)}`, { method: 'POST', timeoutMs: 5000 })
    } catch {}
  }, [ctx])

  const sendText = useCallback(async () => {
    if (!textInput) return
    haptic('tap')
    try {
      await ctx.rest(`/type?text=${encodeURIComponent(textInput)}`, { method: 'POST', timeoutMs: 3000 })
      setTextInput('')
    } catch {}
  }, [ctx, textInput])

  const saveScreenshot = useCallback(async () => {
    haptic('tap')
    try {
      const r = await ctx.rest('/screenshot/save', { method: 'POST', timeoutMs: 5000 })
      if (r?.ok) host.notify({ kind: 'success', message: 'Screenshot saved' })
    } catch {}
  }, [ctx])

  const toggleNetwork = useCallback(async (cond) => {
    haptic('tap')
    try {
      await ctx.rest(`/network/${cond}`, { method: 'POST', timeoutMs: 5000 })
      host.notify({ kind: 'info', message: `Network: ${cond}` })
    } catch {}
  }, [ctx])

  const runShell = useCallback(async () => {
    if (!shellCmd) return
    try {
      const r = await ctx.rest(`/shell?command=${encodeURIComponent(shellCmd)}`, { method: 'POST', timeoutMs: 15000 })
      setShellOut(r?.stdout || 'no output')
    } catch { setShellOut('request failed') }
  }, [ctx, shellCmd])

  const fetchGallery = useCallback(async () => {
    try {
      const d = await ctx.rest('/screenshot/gallery', { timeoutMs: 5000 })
      setGallery(d?.screenshots || [])
    } catch {}
  }, [ctx])

  const setGps = useCallback(async () => {
    haptic('tap')
    try {
      await ctx.rest(`/gps/${gpsLat}/${gpsLng}`, { method: 'POST', timeoutMs: 3000 })
      host.notify({ kind: 'success', message: `GPS: ${gpsLat}, ${gpsLng}` })
    } catch {}
  }, [ctx, gpsLat, gpsLng])

  const setBattery = useCallback(async (lvl) => {
    haptic('tap')
    setBatteryLevel(lvl)
    try { await ctx.rest(`/battery/${lvl}`, { method: 'POST', timeoutMs: 3000 }) } catch {}
  }, [ctx])

  const sendDeeplink = useCallback(async () => {
    if (!deeplinkUrl) return
    haptic('tap')
    try {
      await ctx.rest(`/deeplink?url=${encodeURIComponent(deeplinkUrl)}`, { method: 'POST', timeoutMs: 3000 })
    } catch {}
  }, [ctx, deeplinkUrl])

  const sendNotification = useCallback(async () => {
    haptic('tap')
    try {
      await ctx.rest(`/notification?title=${encodeURIComponent(notifTitle)}&body=${encodeURIComponent(notifBody)}`, { method: 'POST', timeoutMs: 3000 })
      host.notify({ kind: 'success', message: 'Notification sent' })
    } catch {}
  }, [ctx, notifTitle, notifBody])

  const toggleRecording = useCallback(async () => {
    haptic('tap')
    if (!isRecording) {
      try { await ctx.rest('/record/start', { method: 'POST' }); setIsRecording(true) } catch {}
    } else {
      try { await ctx.rest('/record/stop', { method: 'POST' }); setIsRecording(false) } catch {}
    }
  }, [ctx, isRecording])

  const runTests = useCallback(async () => {
    haptic('tap')
    setTestOutput('Running tests...')
    try {
      const r = await ctx.rest('/test/run', { method: 'POST', timeoutMs: 300000 })
      setTestOutput(r?.output || 'No output')
    } catch { setTestOutput('Test request failed') }
  }, [ctx])

  let screenContent
  if (!isOnline) {
    screenContent = jsx('div', {
      className: 'flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500',
      children: [
        jsx('div', { key: 'i', className: 'text-3xl', children: '📱' }),
        jsx('div', { key: 'm', className: 'text-sm', children: 'Emulator offline' }),
        jsx('button', {
          key: 'start',
          className: 'rounded-lg border border-green-700 bg-green-900/50 px-4 py-2 text-sm text-green-300 hover:bg-green-800/50 active:bg-green-700/50 font-medium',
          onClick: async () => {
            haptic('tap')
            try {
              await ctx.rest('/start', { method: 'POST', timeoutMs: 10000 })
              host.notify({ kind: 'success', message: 'Starting emulator...' })
            } catch { host.notify({ kind: 'error', message: 'Failed to start' }) }
          },
          children: '▶ Start Emulator',
        }),
        jsx('div', { key: 'c', className: 'text-[10px] text-zinc-600', children: 'Takes ~15s to boot' }),
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

  if (!visible) {
    return jsx('div', {
      className: 'flex items-center justify-center h-full cursor-pointer',
      onClick: () => setVisible(true),
      children: jsx('span', {
        className: 'text-[10px] text-zinc-500 hover:text-zinc-300 writing-mode-vertical',
        style: { writingMode: 'vertical-rl' },
        children: '📱 EMU ▶',
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
                  jsxs('div', {
                    className: 'flex gap-1',
                    children: [
                      jsx('span', { className: 'text-zinc-500', children: avd.device || '' }),
                      jsx('button', {
                        className: 'text-red-400 hover:text-red-300 text-[10px] px-1',
                        onClick: async (e) => {
                          e.stopPropagation()
                          try { await ctx.rest(`/avd/wipe?name=${avd.name}`, { method: 'POST' }); host.notify({ kind: 'info', message: `Wiped ${avd.name}` }) } catch {}
                        },
                        children: '🗑',
                      }),
                    ],
                  }),
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

      // Swipe directions
      jsx('div', {
        className: 'grid grid-cols-4 gap-1',
        children: [
          ['↖', 'left', ''],
          ['⬆', 'up', ''],
          ['⬇', 'down', ''],
          ['➡', 'right', ''],
        ].map(([icon, dir]) =>
          jsx('button', {
            key: dir,
            className: 'rounded border border-zinc-700 bg-zinc-800 py-1 text-xs text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600',
            onClick: () => sendSwipe(dir),
            children: icon,
          })
        ),
      }),

      // Text input
      jsx('div', {
        className: 'flex gap-1',
        children: [
          jsx('input', {
            key: 'input',
            type: 'text',
            value: textInput,
            onChange: (e) => setTextInput(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') sendText() },
            placeholder: 'Type text...',
            className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-600',
          }),
          jsx('button', {
            key: 'send',
            className: 'rounded border border-blue-700 bg-blue-900/50 px-2 py-1 text-xs text-blue-300 hover:bg-blue-800/50',
            onClick: sendText,
            children: '⌨ Send',
          }),
        ],
      }),

      // App drawer toggle
      jsx('button', {
        className: 'flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700/50',
        onClick: () => { if (!showApps) fetchApps(); setShowApps(!showApps) },
        children: [
          jsx('span', { key: 't', children: `📦 Apps` }),
          jsx('span', { key: 'a', className: 'text-zinc-500', children: showApps ? '▲' : '▼' }),
        ],
      }),

      // App list
      showApps && jsx('div', {
        className: 'rounded border border-zinc-700 bg-zinc-900 p-1 max-h-[200px] overflow-y-auto space-y-0.5',
        children: apps.length === 0
          ? jsx('div', { className: 'text-xs text-zinc-500 p-1', children: 'Loading apps...' })
          : [
              // User apps section
              jsx('div', { key: 'uh', className: 'text-[10px] text-blue-400 font-medium px-2 pt-1', children: `📱 Your Apps (${apps.filter(a => a.type === 'user').length})` }),
              ...apps.filter(a => a.type === 'user').map((app) =>
                jsx('button', {
                  key: app.package,
                  className: 'w-full flex justify-between items-center rounded px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors',
                  onClick: () => launchApp(app.package),
                  children: [
                    jsx('span', { className: 'truncate flex-1 text-left font-medium', children: app.label }),
                    jsx('span', { className: 'text-zinc-500 text-[10px] ml-1 shrink-0', children: '▶' }),
                  ],
                })
              ),
              // System apps section
              jsx('div', { key: 'sh', className: 'text-[10px] text-zinc-500 font-medium px-2 pt-1 border-t border-zinc-800 mt-1', children: `⚙ System Apps (${apps.filter(a => a.type === 'system').length})` }),
              ...apps.filter(a => a.type === 'system').map((app) =>
                jsx('button', {
                  key: app.package,
                  className: 'w-full flex justify-between items-center rounded px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-700 transition-colors',
                  onClick: () => launchApp(app.package),
                  children: [
                    jsx('span', { className: 'truncate flex-1 text-left', children: app.label }),
                    jsx('span', { className: 'text-zinc-600 text-[9px] ml-1 shrink-0', children: '▶' }),
                  ],
                })
              ),
            ],
      }),

      // Tools row
      jsx('div', {
        className: 'grid grid-cols-4 gap-1',
        children: [
          ['📸', 'Save', () => saveScreenshot()],
          ['🌐', 'Net', () => setShowTools(!showTools)],
          ['⏺', 'Rec', async () => {
            haptic('tap')
            try { await ctx.rest('/record/start', { method: 'POST' }); host.notify({ kind: 'info', message: 'Recording...' }) } catch {}
          }],
          ['💻', 'Shell', () => setShowTools(!showTools)],
        ].map(([icon, label, fn]) =>
          jsx('button', {
            key: label,
            className: 'flex flex-col items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700',
            onClick: fn,
            children: [
              jsx('span', { key: 'i', className: 'text-sm', children: icon }),
              jsx('span', { key: 'l', children: label }),
            ],
          })
        ),
      }),

      // Tools panel (network sim + shell)
      showTools && jsx('div', {
        className: 'rounded border border-zinc-700 bg-zinc-900 p-2 space-y-1.5',
        children: [
          // Network sim
          jsx('div', { key: 'nh', className: 'text-xs text-zinc-400 font-medium', children: '🌐 Network' }),
          jsx('div', {
            key: 'nb',
            className: 'flex gap-1',
            children: ['offline', 'slow', 'fast'].map((cond) =>
              jsx('button', {
                key: cond,
                className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 py-1 text-xs text-zinc-300 hover:bg-zinc-700',
                onClick: () => toggleNetwork(cond),
                children: cond,
              })
            ),
          }),
          // ADB shell
          jsx('div', { key: 'sh', className: 'text-xs text-zinc-400 font-medium pt-1', children: '💻 ADB Shell' }),
          jsx('div', {
            key: 'si',
            className: 'flex gap-1',
            children: [
              jsx('input', {
                key: 'in',
                type: 'text',
                value: shellCmd,
                onChange: (e) => setShellCmd(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter') runShell() },
                placeholder: 'ls /sdcard',
                className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-600 font-mono',
              }),
              jsx('button', {
                key: 'go',
                className: 'rounded border border-blue-700 bg-blue-900/50 px-2 py-1 text-xs text-blue-300',
                onClick: runShell,
                children: 'Run',
              }),
            ],
          }),
          shellOut && jsx('pre', {
            key: 'so',
            className: 'rounded bg-zinc-950 border border-zinc-800 p-1 text-[10px] text-zinc-400 max-h-[80px] overflow-auto font-mono whitespace-pre-wrap',
            children: shellOut,
          }),
        ],
      }),

      // More Tools toggle
      jsx('button', {
        className: 'flex items-center justify-between rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700/50',
        onClick: () => setShowMore(!showMore),
        children: [
          jsx('span', { key: 't', children: '⚡ More Tools' }),
          jsx('span', { key: 'a', className: 'text-zinc-500', children: showMore ? '▲' : '▼' }),
        ],
      }),

      // More Tools panel
      showMore && jsx('div', {
        className: 'rounded border border-zinc-700 bg-zinc-900 p-2 space-y-2 max-h-[300px] overflow-y-auto',
        children: [
          // GPS
          jsx('div', { key: 'gps-h', className: 'text-xs text-zinc-400 font-medium', children: '📍 GPS Location' }),
          jsx('div', {
            key: 'gps-i',
            className: 'flex gap-1',
            children: [
              jsx('input', { key: 'lat', type: 'text', value: gpsLat, onChange: (e) => setGpsLat(e.target.value), placeholder: 'Lat', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 font-mono' }),
              jsx('input', { key: 'lng', type: 'text', value: gpsLng, onChange: (e) => setGpsLng(e.target.value), placeholder: 'Lng', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 font-mono' }),
              jsx('button', { key: 'set', className: 'rounded border border-blue-700 bg-blue-900/50 px-2 py-1 text-xs text-blue-300', onClick: setGps, children: 'Set' }),
            ],
          }),

          // Battery
          jsx('div', { key: 'bat-h', className: 'text-xs text-zinc-400 font-medium', children: `🔋 Battery: ${batteryLevel}%` }),
          jsx('div', {
            key: 'bat-i',
            className: 'flex gap-1 items-center',
            children: [
              jsx('input', { key: 'slider', type: 'range', min: '0', max: '100', value: batteryLevel, onChange: (e) => setBattery(parseInt(e.target.value)), className: 'flex-1' }),
              jsx('button', { key: 'apply', className: 'rounded border border-blue-700 bg-blue-900/50 px-2 py-1 text-xs text-blue-300', onClick: () => setBattery(batteryLevel), children: 'Set' }),
              jsx('button', { key: 'reset', className: 'rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300', onClick: async () => { try { await ctx.rest('/battery/reset', { method: 'POST' }); setBatteryLevel(100) } catch {} }, children: 'Reset' }),
            ],
          }),

          // Deep Link
          jsx('div', { key: 'dl-h', className: 'text-xs text-zinc-400 font-medium', children: '🔗 Deep Link' }),
          jsx('div', {
            key: 'dl-i',
            className: 'flex gap-1',
            children: [
              jsx('input', { key: 'url', type: 'text', value: deeplinkUrl, onChange: (e) => setDeeplinkUrl(e.target.value), placeholder: 'myapp://path or https://...', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 font-mono' }),
              jsx('button', { key: 'go', className: 'rounded border border-blue-700 bg-blue-900/50 px-2 py-1 text-xs text-blue-300', onClick: sendDeeplink, children: 'Open' }),
            ],
          }),

          // Notification
          jsx('div', { key: 'ntf-h', className: 'text-xs text-zinc-400 font-medium', children: '🔔 Push Notification' }),
          jsx('div', {
            key: 'ntf-i',
            className: 'flex gap-1',
            children: [
              jsx('input', { key: 'title', type: 'text', value: notifTitle, onChange: (e) => setNotifTitle(e.target.value), placeholder: 'Title', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200' }),
              jsx('input', { key: 'body', type: 'text', value: notifBody, onChange: (e) => setNotifBody(e.target.value), placeholder: 'Body', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200' }),
              jsx('button', { key: 'send', className: 'rounded border border-blue-700 bg-blue-900/50 px-2 py-1 text-xs text-blue-300', onClick: sendNotification, children: '🔔' }),
            ],
          }),

          // Recording
          jsx('div', { key: 'rec-h', className: 'text-xs text-zinc-400 font-medium', children: '⏺ Screen Recording' }),
          jsx('div', {
            key: 'rec-b',
            className: 'flex gap-1',
            children: [
              jsx('button', {
                key: 'toggle',
                className: cn('flex-1 rounded border py-1 text-xs font-medium', isRecording ? 'border-red-700 bg-red-900/50 text-red-300' : 'border-zinc-700 bg-zinc-800 text-zinc-300'),
                onClick: toggleRecording,
                children: isRecording ? '⏹ Stop Recording' : '⏺ Start Recording',
              }),
            ],
          }),

          // Test Runner
          jsx('div', { key: 'test-h', className: 'text-xs text-zinc-400 font-medium', children: '🧪 Test Runner' }),
          jsx('div', {
            key: 'test-b',
            className: 'flex gap-1',
            children: [
              jsx('button', { key: 'run', className: 'flex-1 rounded border border-green-700 bg-green-900/50 py-1 text-xs text-green-300 font-medium', onClick: runTests, children: '▶ Run Tests' }),
            ],
          }),
          testOutput && jsx('pre', {
            key: 'test-out',
            className: 'rounded bg-zinc-950 border border-zinc-800 p-1 text-[10px] text-zinc-400 max-h-[60px] overflow-auto font-mono whitespace-pre-wrap',
            children: testOutput,
          }),

          // Screenshot Gallery
          jsx('button', {
            key: 'gal',
            className: 'w-full flex justify-between items-center rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700',
            onClick: () => { if (!showGallery) fetchGallery(); setShowGallery(!showGallery) },
            children: [
              jsx('span', { children: `🖼 Gallery (${gallery.length})` }),
              jsx('span', { className: 'text-zinc-500', children: showGallery ? '▲' : '▼' }),
            ],
          }),
          showGallery && jsx('div', {
            key: 'gal-list',
            className: 'grid grid-cols-3 gap-1',
            children: gallery.length === 0
              ? jsx('div', { className: 'text-xs text-zinc-500 col-span-3', children: 'No screenshots saved' })
              : gallery.slice(0, 9).map((s) =>
                jsx('div', {
                  key: s.name,
                  className: 'rounded border border-zinc-700 bg-zinc-800 p-1 text-[9px] text-zinc-400 truncate',
                  children: s.name.replace('.png', ''),
                })
              ),
          }),
        ],
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
          jsx('button', {
            key: 'stop',
            className: 'rounded-lg border border-red-700 bg-red-900/50 py-1.5 text-xs font-medium text-red-300 hover:bg-red-800/50 transition-colors',
            onClick: async () => {
              haptic('tap')
              try { await ctx.rest('/stop', { method: 'POST', timeoutMs: 5000 }) } catch {}
            },
            children: '⏹ Stop',
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
        data: { placement: 'right', width: '280px', dock: { pane: 'workspace', pos: 'right' } },
        render: () => jsx(EmulatorPane, { ctx }),
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        data: { path: PAGE, label: 'Emulator', codicon: 'device-mobile' },
      },
      {
        id: 'chip',
        area: 'statusBar.right',
        order: 140,
        render: () => jsx(Tip, {
          label: 'Toggle Emulator',
          children: jsx('button', {
            className: cn(
              'inline-flex h-full items-center gap-1 px-1.5 text-[0.6875rem] transition-colors',
              'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
            ),
            type: 'button',
            onClick: () => {
              haptic('tap')
              if (_setVisible) _setVisible(v => !v)
            },
            children: '📱 EMU',
          }),
        }),
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: `${ID}.open`,
          label: 'Toggle Android Emulator',
          keywords: ['android', 'emulator', 'phone', 'device'],
          run: () => { if (_setVisible) _setVisible(v => !v) },
        },
      },
    ])
  },
}
