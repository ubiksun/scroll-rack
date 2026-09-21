// Update check for side-loaded (unpacked) installs. Chrome won't auto-update an unpacked extension, so we do the next
// best thing: fetch release/latest.json from the repo, compare versions, and show a banner with the zip link.
// Replacing the folder contents in place + ↻ on chrome://extensions keeps all data (it lives in the Chrome profile).
// Web Store installs update themselves; the banner simply never fires for them (store version == latest).
export const UPDATE_URL = 'https://raw.githubusercontent.com/ubiksun/scroll-rack/main/release/latest.json'
const CHECK_EVERY = 6 * 60 * 60 * 1000

export interface LatestInfo { version: string; zip: string; notes?: string; date?: string }

export const currentVersion = () => (typeof chrome !== 'undefined' && chrome.runtime?.getManifest ? chrome.runtime.getManifest().version : '0.0.0')

export function isNewer(a: string, b: string) {   // a > b ?
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] ?? 0) - (pb[i] ?? 0); if (d) return d > 0 }
  return false
}

export async function checkForUpdate(force = false): Promise<LatestInfo | null> {
  try {
    const last = Number(localStorage.getItem('lg.updateCheckedAt') ?? 0)
    const cached = localStorage.getItem('lg.latest')
    if (!force && Date.now() - last < CHECK_EVERY && cached) { const l = JSON.parse(cached) as LatestInfo; return isNewer(l.version, currentVersion()) ? l : null }
    const res = await fetch(UPDATE_URL, { cache: 'no-store' })
    if (!res.ok) return null
    const latest = (await res.json()) as LatestInfo
    localStorage.setItem('lg.updateCheckedAt', String(Date.now())); localStorage.setItem('lg.latest', JSON.stringify(latest))
    return isNewer(latest.version, currentVersion()) ? latest : null
  } catch { return null }
}
