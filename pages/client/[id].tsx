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
