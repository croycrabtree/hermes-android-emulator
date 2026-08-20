/**
 * Android Emulator — live right-side pane in Hermes Desktop
 */

import {
  cn,
  haptic,
  host,
  useQuery,
} from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { useState, useRef, useCallback } from 'react'

const ID = 'android-emulator'
const POLL_MS = 3000

function EmulatorPane({ ctx }) {
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
  const [tab, setTab] = useState('controls')
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

  const Tab = ({ id, label }) => jsx('button', {
    className: cn(
      'flex-1 py-1 text-xs font-medium border-b-2 transition-colors',
      tab === id ? 'border-blue-500 text-blue-300' : 'border-transparent text-zinc-500 hover:text-zinc-300'
    ),
    onClick: () => setTab(id),
    children: label,
  })

  return jsxs('div', {
    className: 'flex h-full flex-col text-xs overflow-hidden',
    children: [

      // ── EMULATOR SCREEN (always visible) ──────────────────────────
      screenContent,

      // ── TAB BAR ──────────────────────────────────────────────────
      jsx('div', {
        className: 'flex border-b border-zinc-700 px-2',
        children: [
          jsx(Tab, { id: 'controls', label: '🎮 Controls' }),
          jsx(Tab, { id: 'device', label: '📱 Device' }),
        ],
      }),

      // ── TAB CONTENT ──────────────────────────────────────────────
      jsxs('div', {
        className: 'flex-1 overflow-y-auto p-2 space-y-1.5',
        children: [

          // ═══════════════════════════════════════════════════════════
          // CONTROLS TAB
          // ═══════════════════════════════════════════════════════════
          tab === 'controls' && jsxs('div', {
            className: 'space-y-1.5',
            children: [
              // Type Text
              jsx('div', {
                className: 'flex gap-1',
                children: [
                  jsx('input', {
                    type: 'text',
                    value: textInput,
                    onChange: (e) => setTextInput(e.target.value),
                    onKeyDown: (e) => { if (e.key === 'Enter') sendText() },
                    placeholder: 'Type text here...',
                    className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-600',
                  }),
                  jsx('button', {
                    className: 'rounded border border-blue-700 bg-blue-900/50 px-3 py-1 text-blue-300 hover:bg-blue-800/50',
                    onClick: sendText,
                    children: '⌨️ Send',
                  }),
                ],
              }),

              // Navigation
              jsx('div', {
                className: 'grid grid-cols-6 gap-1',
                children: [
                  ['📊', 'Status Bar', () => ctx.rest('/swipe/status_bar', { method: 'POST' }), false],
                  ['🔙', 'Back', 'BACK', false],
                  ['🏠', 'Home', 'HOME', false],
                  ['📋', 'Recent', 'APP_SWITCH', false],
                  ['⏻', 'Power', 'POWER', true],
                  ['📱', 'App Drawer', () => ctx.rest('/swipe/app_drawer', { method: 'POST' }), false],
                ].map(([icon, label, action, isPower]) =>
                  jsx('button', {
                    key: label,
                    className: 'flex items-center justify-center rounded border border-zinc-700 bg-zinc-800 py-2 text-lg text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600',
                    onClick: () => { haptic('tap'); typeof action === 'function' ? action() : sendKey(action) },
                    title: label,
                    children: isPower
                      ? jsx('span', {
                          className: 'inline-block relative',
                          style: { width: '1em', height: '1em' },
                          children: jsx('span', {
                            style: {
                              display: 'inline-block',
                              width: '0.75em',
                              height: '0.75em',
                              border: '2px solid currentColor',
                              borderRadius: '50%',
                              position: 'relative',
                              top: '-0.12em',
                            },
                            children: jsx('span', {
                              style: {
                                display: 'block',
                                width: '2px',
                                height: '0.5em',
                                background: 'currentColor',
                                position: 'absolute',
                                top: '-0.15em',
                                left: '50%',
                                transform: 'translateX(-50%)',
                              },
                            }),
                          }),
                        })
                      : icon,
                  })
                ),
              }),

              // Swipe
              jsx('div', {
                className: 'grid grid-cols-4 gap-1',
                children: [
                  ['↖️', 'left', 'Swipe left'],
                  ['⬆️', 'up', 'Swipe up'],
                  ['⬇️', 'down', 'Swipe down'],
                  ['➡️', 'right', 'Swipe right'],
                ].map(([icon, dir, tip]) =>
                  jsx('button', {
                    key: dir,
                    className: 'rounded border border-zinc-700 bg-zinc-800 py-1 text-zinc-300 hover:bg-zinc-700 active:bg-zinc-600',
                    onClick: () => sendSwipe(dir),
                    title: tip,
                    children: icon,
                  })
                ),
              }),


              // Quick Tools
              jsx('div', {
                className: 'grid grid-cols-4 gap-1',
                children: [
                  ['📸', 'Screenshot', () => saveScreenshot()],
                  ['🌐', 'Network', () => setShowTools(!showTools)],
                  ['⏺️', 'Record', () => toggleRecording()],
                  ['💻', 'Shell', () => setShowTools(!showTools)],
                ].map(([icon, label, fn]) =>
                  jsx('button', {
                    key: label,
                    className: 'flex items-center justify-center rounded border border-zinc-700 bg-zinc-800 py-2 text-lg text-zinc-300 hover:bg-zinc-700',
                    onClick: fn,
                    title: label,
                    children: icon,
                  })
                ),
              }),


              // Network Simulator
              showTools && jsx('div', {
                className: 'rounded border border-zinc-700 bg-zinc-900 p-2 space-y-1.5',
                children: [
                  jsx('div', { className: 'text-zinc-400 font-medium', children: '🌐 Network Condition' }),
                  jsx('div', {
                    className: 'flex gap-1',
                    children: ['offline', 'slow', 'fast'].map((cond) =>
                      jsx('button', {
                        key: cond,
                        className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 py-1 text-zinc-300 hover:bg-zinc-700',
                        onClick: () => toggleNetwork(cond),
                        children: cond,
                      })
                    ),
                  }),
                  jsx('div', { className: 'text-[10px] text-zinc-500', children: 'offline = no data · slow = 500ms latency · fast = normal' }),
                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: '💻 ADB Shell' }),
                  jsx('div', {
                    className: 'flex gap-1',
                    children: [
                      jsx('input', {
                        type: 'text',
                        value: shellCmd,
                        onChange: (e) => setShellCmd(e.target.value),
                        onKeyDown: (e) => { if (e.key === 'Enter') runShell() },
                        placeholder: 'e.g. ls /sdcard',
                        className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 placeholder-zinc-500 outline-none focus:border-blue-600 font-mono',
                      }),
                      jsx('button', {
                        className: 'rounded border border-blue-700 bg-blue-900/50 px-3 py-1 text-blue-300',
                        onClick: runShell,
                        children: 'Run',
                      }),
                    ],
                  }),
                  shellOut && jsx('pre', {
                    className: 'rounded bg-zinc-950 border border-zinc-800 p-1 text-[10px] text-zinc-400 max-h-[80px] overflow-auto font-mono whitespace-pre-wrap',
                    children: shellOut,
                  }),
                ],
              }),

              // Controls bar
              jsx('div', {
                className: 'flex gap-1',
                children: [
                  jsx('button', {
                    className: cn(
                      'flex-1 rounded border py-1.5 font-medium',
                      autoRefresh ? 'border-blue-700 bg-blue-900/50 text-blue-300' : 'border-zinc-700 bg-zinc-800 text-zinc-200'
                    ),
                    onClick: () => setAutoRefresh(!autoRefresh),
                    children: autoRefresh ? '⏸ Pause' : '▶ Live',
                  }),
                  jsx('button', {
                    className: cn(
                      'flex-1 rounded border py-1.5 font-medium',
                      showLog ? 'border-amber-700 bg-amber-900/50 text-amber-300' : 'border-zinc-700 bg-zinc-800 text-zinc-200'
                    ),
                    onClick: () => { fetchLogcat(); setShowLog(!showLog) },
                    children: showLog ? '📜 Hide Log' : '📜 Logcat',
                  }),
                  jsx('button', {
                    className: 'rounded border border-red-700 bg-red-900/50 py-1.5 px-3 font-medium text-red-300',
                    onClick: async () => { haptic('tap'); try { await ctx.rest('/stop', { method: 'POST', timeoutMs: 5000 }) } catch {} },
                    children: '⏹ Stop',
                  }),
                ],
              }),

              // Logcat
              showLog && jsx('div', {
                className: 'flex-1 min-h-0 overflow-auto rounded bg-zinc-950 border border-zinc-800 p-1 font-mono text-[10px] leading-relaxed',
                children: logcat.length === 0
                  ? jsx('div', { className: 'text-zinc-600', children: 'No log output' })
                  : logcat.map((line, i) =>
                    jsx('div', {
                      key: i,
                      className: cn(
                        'whitespace-pre-wrap break-all',
                        line.includes(' E ') ? 'text-red-400' : line.includes(' W ') ? 'text-amber-400' : line.includes(' I ') ? 'text-green-400' : 'text-zinc-500'
                      ),
                      children: line,
                    })
                  ),
              }),
            ],
          }),

          // ═══════════════════════════════════════════════════════════
          // DEVICE TAB
          // ═══════════════════════════════════════════════════════════
          tab === 'device' && jsxs('div', {
            className: 'space-y-1.5',
            children: [

              // Status
              jsx('div', {
                className: cn(
                  'flex items-center gap-2 rounded px-2 py-1 border',
                  isOnline ? 'bg-green-950/30 border-green-800/40 text-green-300' : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                ),
                children: jsxs('div', {
                  className: 'flex items-center gap-1.5',
                  children: [
                    jsx('span', { className: cn('h-2 w-2 rounded-full', isOnline ? 'bg-green-400 animate-pulse' : 'bg-zinc-500') }),
                    jsx('span', {
                      className: 'font-medium',
                      children: isOnline ? `Android ${status?.android_version || '?'} · SDK ${status?.sdk || '?'}` : 'Offline',
                    }),
                  ],
                }),
              }),

              // Start button (when offline)
              !isOnline && jsx('button', {
                className: 'w-full rounded border border-green-700 bg-green-900/50 py-2 text-green-300 font-medium',
                onClick: async () => {
                  haptic('tap')
                  try { await ctx.rest('/start', { method: 'POST', timeoutMs: 10000 }); host.notify({ kind: 'success', message: 'Starting emulator...' }) } catch { host.notify({ kind: 'error', message: 'Failed to start' }) }
                },
                children: '▶ Start Emulator',
              }),

              // Device Picker
              jsx('button', {
                className: 'flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-zinc-300 hover:bg-zinc-700/50',
                onClick: () => setShowPicker(!showPicker),
                children: [
                  jsx('span', { children: `📱 Device: ${picker?.active_avd || 'None'}` }),
                  jsx('span', { className: 'text-zinc-500', children: showPicker ? '▲' : '▼' }),
                ],
              }),
              showPicker && jsx('div', {
                className: 'rounded border border-zinc-700 bg-zinc-900 p-2 space-y-2 max-h-[300px] overflow-y-auto',
                children: [
                  jsx('div', { className: 'text-zinc-400 font-medium', children: 'Your Devices' }),
                  ...(picker?.avds || []).map((avd) =>
                    jsx('button', {
                      key: avd.name,
                      className: cn(
                        'w-full text-left rounded border px-2 py-1.5 transition-colors',
                        avd.name === picker?.active_avd ? 'border-blue-700 bg-blue-900/30 text-blue-300' : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      ),
                      onClick: () => host.notify({ kind: 'info', message: `Switch: emu stop && emu start ${avd.name}` }),
                      children: jsxs('div', {
                        className: 'flex justify-between items-center',
                        children: [
                          jsx('span', { className: 'font-medium', children: avd.name }),
                          jsx('span', { className: 'text-zinc-500 text-[10px]', children: avd.device || '' }),
                        ],
                      }),
                    })
                  ),
                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: 'Create New Device' }),
                  jsx('div', {
                    className: 'grid grid-cols-2 gap-1',
                    children: (picker?.devices || []).map((dev) =>
                      jsx('button', {
                        key: dev.id,
                        className: 'text-left rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700 truncate',
                        onClick: async () => {
                          haptic('tap')
                          const name = `avd-${dev.id}`
                          try {
                            const r = await ctx.rest(`/create?name=${name}&device=${dev.id}&api=34`, { method: 'POST', timeoutMs: 60000 })
                            host.notify({ kind: r?.ok ? 'success' : 'error', message: r?.ok ? `Created ${name}!` : (r?.error || 'Failed') })
                          } catch { host.notify({ kind: 'error', message: 'Failed' }) }
                        },
                        children: dev.name || dev.id,
                      })
                    ),
                  }),
                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: 'Android Versions' }),
                  jsx('div', {
                    className: 'flex flex-wrap gap-1',
                    children: [
                      ...(picker?.installed_images || []).map((img) =>
                        jsx('span', { key: img.package, className: 'rounded-full border border-green-700 bg-green-900/30 px-2 py-0.5 text-green-300', children: `API ${img.api} ✓` })
                      ),
                      ...(picker?.available_images || []).map((img) =>
                        jsx('button', {
                          key: img.package,
                          className: 'rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200',
                          onClick: async () => {
                            haptic('tap')
                            host.notify({ kind: 'info', message: `Installing API ${img.api}...` })
                            try {
                              const r = await ctx.rest(`/create?name=api${img.api}-test&device=pixel_6&api=${img.api}`, { method: 'POST', timeoutMs: 300000 })
                              host.notify({ kind: r?.ok ? 'success' : 'error', message: r?.ok ? `API ${img.api} installed!` : (r?.error || 'Failed') })
                            } catch { host.notify({ kind: 'error', message: 'Failed' }) }
                          },
                          children: `API ${img.api}`,
                        })
                      ),
                    ],
                  }),
                  jsx('div', { className: 'text-[10px] text-zinc-600 pt-1', children: 'Green = installed · Gray = click to install' }),
                ],
              }),

              // Apps
              jsx('button', {
                className: 'flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-zinc-300 hover:bg-zinc-700/50',
                onClick: () => { if (!showApps) fetchApps(); setShowApps(!showApps) },
                children: [
                  jsx('span', { children: '📦 Installed Apps' }),
                  jsx('span', { className: 'text-zinc-500', children: showApps ? '▲' : '▼' }),
                ],
              }),
              showApps && jsx('div', {
                className: 'rounded border border-zinc-700 bg-zinc-900 p-1 max-h-[200px] overflow-y-auto space-y-0.5',
                children: apps.length === 0
                  ? jsx('div', { className: 'text-zinc-500 p-1', children: 'Loading apps...' })
                  : [
                      jsx('div', { key: 'uh', className: 'text-[10px] text-blue-400 font-medium px-2 pt-1', children: `📱 Your Apps (${apps.filter(a => a.type === 'user').length})` }),
                      ...apps.filter(a => a.type === 'user').map((app) =>
                        jsx('button', {
                          key: app.package,
                          className: 'w-full flex justify-between items-center rounded px-2 py-1 text-zinc-200 hover:bg-zinc-700',
                          onClick: () => launchApp(app.package),
                          children: [
                            jsx('span', { className: 'truncate flex-1 text-left font-medium', children: app.label }),
                            jsx('span', { className: 'text-zinc-500 text-[10px]', children: '▶ Launch' }),
                          ],
                        })
                      ),
                      jsx('div', { key: 'sh', className: 'text-[10px] text-zinc-500 font-medium px-2 pt-1 border-t border-zinc-800 mt-1', children: `⚙ System Apps (${apps.filter(a => a.type === 'system').length})` }),
                      ...apps.filter(a => a.type === 'system').map((app) =>
                        jsx('button', {
                          key: app.package,
                          className: 'w-full flex justify-between items-center rounded px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-700',
                          onClick: () => launchApp(app.package),
                          children: [
                            jsx('span', { className: 'truncate flex-1 text-left', children: app.label }),
                            jsx('span', { className: 'text-zinc-600 text-[9px]', children: '▶' }),
                          ],
                        })
                      ),
                    ],
              }),

              // Advanced Tools
              jsx('button', {
                className: 'flex items-center justify-between rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-zinc-300 hover:bg-zinc-700/50',
                onClick: () => setShowMore(!showMore),
                children: [
                  jsx('span', { children: '⚡ Advanced Tools' }),
                  jsx('span', { className: 'text-zinc-500', children: showMore ? '▲' : '▼' }),
                ],
              }),
              showMore && jsx('div', {
                className: 'rounded border border-zinc-700 bg-zinc-900 p-2 space-y-2',
                children: [
                  jsx('div', { className: 'text-zinc-400 font-medium', children: '📍 GPS — Fake Location' }),
                  jsx('div', { className: 'text-[10px] text-zinc-500', children: 'Fake GPS for location-based testing' }),
                  jsx('div', {
                    className: 'flex gap-1',
                    children: [
                      jsx('input', { type: 'text', value: gpsLat, onChange: (e) => setGpsLat(e.target.value), placeholder: 'Latitude', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 font-mono' }),
                      jsx('input', { type: 'text', value: gpsLng, onChange: (e) => setGpsLng(e.target.value), placeholder: 'Longitude', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 font-mono' }),
                      jsx('button', { className: 'rounded border border-blue-700 bg-blue-900/50 px-3 py-1 text-blue-300', onClick: setGps, children: 'Set' }),
                    ],
                  }),

                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: `🔋 Battery: ${batteryLevel}%` }),
                  jsx('div', { className: 'text-[10px] text-zinc-500', children: 'Simulate low battery' }),
                  jsx('div', {
                    className: 'flex gap-1 items-center',
                    children: [
                      jsx('input', { type: 'range', min: '0', max: '100', value: batteryLevel, onChange: (e) => setBattery(parseInt(e.target.value)), className: 'flex-1' }),
                      jsx('button', { className: 'rounded border border-blue-700 bg-blue-900/50 px-2 py-1 text-blue-300', onClick: () => setBattery(batteryLevel), children: 'Set' }),
                      jsx('button', { className: 'rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300', onClick: async () => { try { await ctx.rest('/battery/reset', { method: 'POST' }); setBatteryLevel(100) } catch {} }, children: 'Reset' }),
                    ],
                  }),

                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: '🔗 Deep Link' }),
                  jsx('div', { className: 'text-[10px] text-zinc-500', children: 'Open a URL or app deep link' }),
                  jsx('div', {
                    className: 'flex gap-1',
                    children: [
                      jsx('input', { type: 'text', value: deeplinkUrl, onChange: (e) => setDeeplinkUrl(e.target.value), placeholder: 'myapp://path or https://...', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 font-mono' }),
                      jsx('button', { className: 'rounded border border-blue-700 bg-blue-900/50 px-3 py-1 text-blue-300', onClick: sendDeeplink, children: 'Open' }),
                    ],
                  }),

                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: '🔔 Push Notification' }),
                  jsx('div', { className: 'text-[10px] text-zinc-500', children: 'Send a test notification' }),
                  jsx('div', {
                    className: 'flex gap-1',
                    children: [
                      jsx('input', { type: 'text', value: notifTitle, onChange: (e) => setNotifTitle(e.target.value), placeholder: 'Title', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200' }),
                      jsx('input', { type: 'text', value: notifBody, onChange: (e) => setNotifBody(e.target.value), placeholder: 'Message', className: 'flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200' }),
                      jsx('button', { className: 'rounded border border-blue-700 bg-blue-900/50 px-3 py-1 text-blue-300', onClick: sendNotification, children: 'Send' }),
                    ],
                  }),

                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: '⏺️ Screen Recording' }),
                  jsx('button', {
                    className: cn('w-full rounded border py-1.5 font-medium', isRecording ? 'border-red-700 bg-red-900/50 text-red-300' : 'border-zinc-700 bg-zinc-800 text-zinc-300'),
                    onClick: toggleRecording,
                    children: isRecording ? '⏹ Stop Recording' : '⏺ Start Recording',
                  }),

                  jsx('div', { className: 'text-zinc-400 font-medium pt-1 border-t border-zinc-800', children: '🧪 Test Runner' }),
                  jsx('button', { className: 'w-full rounded border border-green-700 bg-green-900/50 py-1.5 text-green-300 font-medium', onClick: runTests, children: '▶ Run Tests' }),
                  testOutput && jsx('pre', {
                    className: 'rounded bg-zinc-950 border border-zinc-800 p-1 text-[10px] text-zinc-400 max-h-[60px] overflow-auto font-mono whitespace-pre-wrap',
                    children: testOutput,
                  }),

                  jsx('button', {
                    className: 'w-full flex justify-between items-center rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700',
                    onClick: () => { if (!showGallery) fetchGallery(); setShowGallery(!showGallery) },
                    children: [
                      jsx('span', { children: `🖼 Screenshot Gallery (${gallery.length})` }),
                      jsx('span', { className: 'text-zinc-500', children: showGallery ? '▲' : '▼' }),
                    ],
                  }),
                  showGallery && jsx('div', {
                    className: 'grid grid-cols-3 gap-1',
                    children: gallery.length === 0
                      ? jsx('div', { className: 'text-zinc-500 col-span-3', children: 'No screenshots yet' })
                      : gallery.slice(0, 9).map((s) =>
                        jsx('div', { key: s.name, className: 'rounded border border-zinc-700 bg-zinc-800 p-1 text-[9px] text-zinc-400 truncate', children: s.name.replace('.png', '') })
                      ),
                  }),
                ],
              }),

              // Footer
              isOnline && status?.screen_size && jsx('div', {
                className: 'text-center text-[9px] text-zinc-600 mt-1',
                children: `Screen: ${status.screen_size}`,
              }),
            ],
          }),
        ],
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
        data: { placement: 'right', width: '300px' },
        render: () => jsx(EmulatorPane, { ctx }),
      },
    ])
  },
}
