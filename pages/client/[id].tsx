'use client'

import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()

export default function ClientPage() {
  const router = useRouter()
  const { id: clientId } = router.query

  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    if (!clientId) return
    const fetchData = async () => {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()
      setClient(data)
    }
    fetchData()
  }, [clientId])

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{client?.client_name || 'Client'}</h1>
    </div>
  )
}
