import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";

export default function OpportunityPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { id } = router.query;

  const [opportunity, setOpportunity] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<"proposal" | "contract" | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const { data: oppData } = await supabase
        .from("opportunities")
        .select("*, clients(name)")
        .eq("id", id)
        .single();

      setOpportunity(oppData);

      const { data: meetingData } = await supabase
        .from("meetings")
        .select("id, summary")
        .eq("opportunity_id", id)
        .order("created_at", { ascending: true });

      setMeetings(meetingData || []);
    };

    fetchData();
  }, [id]);

  const handleGenerate = async () => {
    if (!documentType || selectedMeetingIds.length === 0) return;
    setGenerating(true);

    const selected = meetings.filter((m) => selectedMeetingIds.includes(m.id));
    const titleText = documentType === "proposal" ? "Proposal Document" : "Contract Document";

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: titleText,
              heading: HeadingLevel.TITLE,
            }),
            ...selected.map((meeting, idx) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Meeting ${idx + 1} Summary:`,
                    bold: true,
                  }),
                  new TextRun("\n" + meeting.summary),
                ],
              })
            ),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${titleText}.docx`;
    a.click();
    setGenerating(false);
  };

  return (
    <main>
      <h1>Opportunity</h1>
      {opportunity && <h2>{opportunity.name}</h2>}

      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setDocumentType("proposal")} disabled={documentType === "proposal"}>
          Generate Proposal
        </button>
        <button
          onClick={() => setDocumentType("contract")}
          disabled={documentType === "contract"}
          style={{ marginLeft: "10px" }}
        >
          Generate Contract
        </button>
      </div>

      <ul>
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedMeetingIds.includes(meeting.id)}
                onChange={(e) => {
                  setSelectedMeetingIds((prev) =>
                    e.target.checked ? [...prev, meeting.id] : prev.filter((id) => id !== meeting.id)
                  );
                }}
              />
              {meeting.summary.slice(0, 100)}...
            </label>
          </li>
        ))}
      </ul>

      <button onClick={handleGenerate} disabled={generating || !documentType || selectedMeetingIds.length === 0}>
        {generating ? "Generating..." : "Generate Document"}
      </button>
    </main>
  );
}


