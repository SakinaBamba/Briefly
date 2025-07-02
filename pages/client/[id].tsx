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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return

    const fetchData = async () => {
      try {
        const {
          data: clientData,
          error: clientError,
        } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single()
        if (clientError) console.error(clientError)
        setClient(clientData)

        if (clientData) {
          const {
            data: opps,
            error: oppError,
          } = await supabase
            .from('opportunities')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
          if (oppError) console.error(oppError)
          setOpportunities(opps || [])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [clientId])

  if (loading) return <p>Loading...</p>
  if (!client) return <p>Client not found.</p>

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
