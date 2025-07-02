// File: pages/opportunity/[id].tsx

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function MeetingDetailPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const res = await fetch(`/api/getMeetingDetails?id=${id}`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const downloadTranscript = () => {
    const blob = new Blob([data?.transcript || ''], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${id}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-10 text-xl">Loading...</div>;
  if (!data) return <div className="p-10 text-xl">Meeting not found.</div>;

  return (
    <div className="p-10 max-w-4xl mx-auto space-y-8">
      <Link href="/dashboard" className="text-blue-600 hover:underline">
        Back to Dashboard
      </Link>

      <div className="text-3xl font-semibold">{data.title}</div>
      <div className="text-gray-500">{new Date(data.date).toLocaleString()}</div>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold mb-2">Summary</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{data.summary}</p>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">Transcript</h2>
          <button
            onClick={downloadTranscript}
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition"
          >
            Download Transcript
          </button>
        </div>
        <div className="text-gray-700 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
          {data.transcript}
        </div>
      </div>
    </div>
  );
}



