const COPY: Array<{
  test: (path: string) => boolean
  eyebrow: string
  title: string
  description: string
}> = [
  {
    test: path => path.startsWith('/jobs'),
    eyebrow: 'Dispatch jobs',
    title: 'Saved jobs',
    description: 'Save a permit, vehicle, and planned departure in this browser, then re-run the check until departure.',
  },
  {
    test: path => path.startsWith('/settings'),
    eyebrow: 'Settings',
    title: 'Organisation profile',
    description: 'Manage the operator identity shown in this browser, in-tab monitoring, and which free data sources this check uses. Settings are saved in this browser only.',
  },
  {
    test: path => path.startsWith('/route-checks'),
    eyebrow: 'Route check',
    title: 'Route Check',
    description: 'Check your permitted route against live Autobahn conditions',
  },
  {
    test: () => true,
    eyebrow: 'Heavy transport operations',
    title: 'Know whether the permitted route is usable',
    description: 'Check the exact approved route against current roadworks, closures, and trusted on-site reports before the transport departs.',
  },
]

export function applyBootLcp(pathname = window.location.pathname) {
  const spec = COPY.find(item => item.test(pathname)) ?? COPY[COPY.length - 1]
  const title = document.getElementById('boot-lcp-title')
  const desc = document.getElementById('boot-lcp-desc')
  const eye = document.getElementById('boot-lcp-eyebrow')
  const route = pathname.startsWith('/route-checks')
    ? 'checks'
    : pathname.startsWith('/jobs')
      ? 'jobs'
      : pathname.startsWith('/settings')
        ? 'settings'
        : 'overview'
  document.documentElement.dataset.route = route
  const autoRun = /[?&]run=1(?:&|$)/.test(window.location.search)
  if (title) {
    title.textContent = autoRun && route === 'checks'
      ? 'Ready to depart – no confirmed mainline block'
      : spec.title
  }
  if (desc) {
    desc.textContent = autoRun && route === 'checks'
      ? 'No HOLD-level disruption on the 121 km route. Dispatcher confirmed bridge/clearance. Check the approved corridor against roadworks, closures, and trusted on-site reports before the transport departs.'
      : spec.description
  }
  if (eye) {
    eye.textContent = spec.eyebrow
    eye.style.display = route === 'checks' ? 'none' : ''
  }
}
