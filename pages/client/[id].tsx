'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Link from 'next/link'

const supabase = createClientComponentClient()

export default function ClientPage() {
  const router = useRouter()
  const { id: clientId } = router.query

  const [client, setClient] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])

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
        .order('created_at', { ascending: false })
      setOpportunities(opps || [])
    }

    fetchData()
  }, [clientId])

  if (!client) return <p>Loading...</p>

  return (
    <div>
      <Link href="/clients" style={{ color: 'blue', textDecoration: 'none' }}>
        ← Back to Clients
      </Link>
      <h2>{client.name}</h2>

      <h3>Opportunities</h3>
      {opportunities.length === 0 ? (
        <p>No opportunities yet.</p>
      ) : (
        <ul>
          {opportunities.map(opp => (
            <li key={opp.id}>
              <Link href={`/opportunity/${opp.id}`} style={{ color: 'blue', textDecoration: 'none' }}>
                {opp.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
