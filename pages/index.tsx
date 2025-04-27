// File: /pages/index.tsx

import { useEffect, useState } from 'react';

interface Meeting {
  id: string;
  title: string;
  summary: string;
  client_id: string | null;
}

interface Client {
  id: string;
  client_name: string;
}

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignMeetingId, setAssignMeetingId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    fetchMeetings();
    fetchClients();
  }, []);

  const fetchMeetings = async () => {
    const res = await fetch('/api/getMeetings');
    const data = await res.json();
    setMeetings(data.meetings);
    setLoading(false);
  };

  const fetchClients = async () => {
    const res = await fetch('/api/getClients');
    const data = await res.json();
    setClients(data.clients);
  };

  const handleAssign = async () => {
    if (!assignMeetingId || !selectedClientId) return;
    await fetch('/api/assignMeetingToClient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: assignMeetingId, clientId: selectedClientId })
    });
    setAssignMeetingId(null);
    setSelectedClientId(null);
    fetchMeetings();
  };

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
                <button
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
                  onClick={() => setAssignMeetingId(meeting.id)}
                >
                  Assign to Client
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {assignMeetingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Assign Meeting</h2>
            <select
              className="w-full p-2 border mb-4"
              value={selectedClientId || ''}
              onChange={e => setSelectedClientId(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded"
                onClick={() => setAssignMeetingId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={handleAssign}
                disabled={!selectedClientId}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

