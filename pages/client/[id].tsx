'use client'


import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

export default function ClientPage() {
  const router = useRouter()
  const { id: clientId } = router.query

  const [client, setClient] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [meetings, setMeetings] = useState<any[]>([])
  const [opportunityClarifications, setOpportunityClarifications] = useState<{ [key: string]: any[] }>({})

  useEffect(() => {
    if (!clientId) return

    const fetchData = async () => {
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      setClient(clientData)

      const { data: opps } = await supabase
        .from('opportunities')
        .select('*')
        .eq('client_id', clientId)
      setOpportunities(opps || [])

      const { data: mtgs } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)

      setMeetings(mtgs || [])

      const { data: clars } = await supabase
        .from('clarifications')
        .select('*')
        .in('opportunity_id', (opps || []).map(o => o.id))

      const clarMap: { [key: string]: any[] } = {}
      ;(clars || []).forEach((c: any) => {
        if (!clarMap[c.opportunity_id]) clarMap[c.opportunity_id] = []
        clarMap[c.opportunity_id].push(c)
      })
      setOpportunityClarifications(clarMap)
    }

    fetchData()
  }, [clientId])

  if (!client) {
    return <p>Loading client...</p>
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">{client.client_name || client.name}</h1>

      <section>
        <h2 className="text-xl font-semibold mb-2">Opportunities</h2>
        {opportunities.length === 0 ? (
          <p>No opportunities found.</p>
        ) : (
          <ul className="space-y-4">
            {opportunities.map((op) => (
              <li key={op.id} className="p-4 border rounded">
                <h3 className="font-medium">{op.name}</h3>
                {opportunityClarifications[op.id]?.length > 0 && (
                  <ul className="list-disc pl-5 mt-2">
                    {opportunityClarifications[op.id].map((clar, idx) => (
                      <li key={idx}>{clar.user_response || clar.ai_question}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Meetings</h2>
        {meetings.length === 0 ? (
          <p>No meetings found.</p>
        ) : (
          <ul className="space-y-4">
            {meetings.map((m) => (
              <li key={m.id} className="p-4 border rounded">
                <h3 className="font-medium">{m.title}</h3>
                <p className="text-sm text-gray-600">{m.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
