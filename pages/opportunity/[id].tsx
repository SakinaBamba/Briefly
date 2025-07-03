"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import Link from "next/link"

export default function OpportunityDetail() {
  const router = useRouter()
  const { id } = router.query
  const supabase = createClientComponentClient()

  const [opportunity, setOpportunity] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [selectedMeetings, setSelectedMeetings] = useState<any[]>([])
  const [documentType, setDocumentType] = useState("proposal")
  const [isGenerating, setIsGenerating] = useState(false)
  const [suggestions, setSuggestions] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (!id) return
    fetchOpportunity()
    fetchMeetings()
  }, [id])

  async function fetchOpportunity() {
    const { data } = await supabase.from("opportunities").select("*").eq("id", id).single()
    setOpportunity(data)
  }

  async function fetchMeetings() {
    const { data } = await supabase
      .from("meetings")
      .select("*")
      .eq("opportunity_id", id)
      .order("created_at", { ascending: true })
    setMeetings(data || [])
  }

  async function handleGenerateDocument() {
    if (!selectedMeetings.length) return alert("Select at least one meeting.")
    setIsGenerating(true)

    const response = await fetch("/api/prepare-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_ids: selectedMeetings.map((m) => m.id),
        type: documentType,
        opportunity_id: id,
      }),
    })

    if (!response.ok) {
      setIsGenerating(false)
      return alert("Failed to generate document.")
    }

    const { document_url } = await response.json()
    setIsGenerating(false)
    window.open(document_url, "_blank")
  }

  function toggleMeeting(meeting: any) {
    if (selectedMeetings.some((m) => m.id === meeting.id)) {
      setSelectedMeetings((prev) => prev.filter((m) => m.id !== meeting.id))
    } else {
      setSelectedMeetings((prev) => [...prev, meeting])
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString()
  }

  if (!opportunity) return <p>Loading...</p>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Opportunity: {opportunity.name}</h1>

      <div className="mb-4">
        <label className="mr-2">Document Type:</label>
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="border px-2 py-1"
        >
          <option value="proposal">Proposal</option>
          <option value="contract">Contract</option>
        </select>
      </div>

      <button
        onClick={handleGenerateDocument}
        disabled={isGenerating || !selectedMeetings.length}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {isGenerating ? "Generating..." : "Generate Document"}
      </button>

      <h2 className="text-xl font-semibold mt-8 mb-2">Meetings</h2>
      {meetings.map((meeting) => (
        <div
          key={meeting.id}
          className={`border p-4 my-4 rounded cursor-pointer ${
            selectedMeetings.some((m) => m.id === meeting.id)
              ? "border-blue-600 bg-blue-50"
              : "border-gray-300"
          }`}
          onClick={() => toggleMeeting(meeting)}
        >
          <Link href={`/meeting/${meeting.id}`} passHref legacyBehavior>
            <a className="block text-lg font-bold hover:underline">
              {meeting.title || "Untitled Meeting"}
            </a>
          </Link>
          <p className="text-sm text-gray-600 mb-2">{formatDate(meeting.created_at)}</p>
          <p className="whitespace-pre-wrap mb-2">{meeting.summary}</p>

          {/* Suggestion Box */}
          <div className="mt-2">
            <textarea
              className="w-full p-2 border rounded"
              placeholder="Suggest a clarification or correction..."
              value={suggestions[meeting.id] || ""}
              onChange={(e) =>
                setSuggestions({ ...suggestions, [meeting.id]: e.target.value })
              }
            />
            <button
              className="mt-2 bg-green-600 text-white px-4 py-1 rounded"
              onClick={async () => {
                const suggestion = suggestions[meeting.id]
                if (!suggestion) return

                const res = await fetch("/api/suggest", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    suggestion,
                    meeting_id: meeting.id,
                    opportunity_id: id,
                  }),
                })

                if (!res.ok) {
                  alert("Failed to submit suggestion")
                  return
                }

                const { updated_summary } = await res.json()
                alert("Summary updated!")
                fetchMeetings()
              }}
            >
              Submit Suggestion
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}


