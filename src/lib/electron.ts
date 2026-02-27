/**
 * Electron environment check utilities
 * 
 * For Next.js API routes, we cannot use `window` because they run on server (Node.js).
 * Instead, we check for custom header sent from the client or use process.env
 */

// Check if we're running in Electron environment
export function isElectron(request?: Request): boolean {
  // First check process.env (works in both client and server)
  if (process.env.ELECTRON === 'true') {
    return true
  }
  
  // If request is provided, check for custom header
  if (request) {
    const electronHeader = request.headers.get('x-electron')
    if (electronHeader === 'true') {
      return true
    }
  }
  
  // Fallback: check window only in browser context
  // This won't work in API routes (server-side) but helps in client-side code
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return true
  }
  
  return false
}

// Helper to get Electron API from window (client-side only)
export function getElectronAPI() {
  if (typeof window !== 'undefined') {
    return (window as any).electronAPI
  }
  return null
}
