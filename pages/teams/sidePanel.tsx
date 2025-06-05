'use client'

import { useEffect } from 'react'
import * as microsoftTeams from '@microsoft/teams-js'

export default function SidePanel() {
  useEffect(() => {
    microsoftTeams.app.initialize().catch((err) => {
      console.error('Failed to initialize Teams SDK', err)
    })
  }, [])

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Briefly</h2>
      <p>Side panel content coming soon.</p>
    </div>
  )
}
