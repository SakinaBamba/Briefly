// File: /pages/index.tsx

import { useEffect, useState } from 'react';

interface Meeting {
  id: string;
  title: string;
  summary: string;
  client_id: string | null;
}

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/getMeetings')
      .then(res => res.json())
      .then(data => {
        setMeetings(data.meetings);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Loading meetings...</p>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Your Meetings</h1>
      {meetings.length === 0 ? (
        <p>No meetings found.</p>
      ) : (
        <div className="space-y-4">
          {meetings.map(meeting => (
            <div key={meeting.id} className="p-4 border rounded-lg">
              <h2 className="text-xl font-semibold">{meeting.title}</h2>
              <p className="text-gray-600 mt-2">{meeting.summary}</p>
              <p className="text-sm mt-2">
                Client: {meeting.client_id ? meeting.client_id : 'Unassigned'}
              </p>
              {!meeting.client_id && (
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded">
                  Assign to Client
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

