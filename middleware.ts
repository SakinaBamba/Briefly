// File: middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // If someone hits the trailing-slash variant...
  if (req.nextUrl.pathname === '/api/graph/notifications/') {
    // Rewrite it back to the no-slash version
    const url = req.nextUrl.clone()
    url.pathname = '/api/graph/notifications'
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/graph/notifications/:path*'],
}
