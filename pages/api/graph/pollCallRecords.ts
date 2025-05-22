// pollCallRecords.ts

const response = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});


const meetings = await response.json();

for (const meeting of meetings.value) {
  const meetingId = meeting.id;
  const title = meeting.subject;
  const startTime = new Date(meeting.startDateTime);
  const endTime = new Date(meeting.endDateTime);
  const now = new Date();

  const { data: existing, error } = await supabase
    .from('meetings')
    .select('status')
    .eq('meeting_id', meetingId)
    .single();

  if (!existing) {
    // Insert new meeting
    await supabase.from('meetings').insert([
      {
        meeting_id: meetingId,
        title,
        start_time: startTime,
        end_time: endTime,
        status: endTime < now ? 'ended' : 'scheduled',
      },
    ]);
  } else if (existing.status === 'scheduled' && endTime < now) {
    // Update to ended if it's now over
    await supabase
      .from('meetings')
      .update({ status: 'ended' })
      .eq('meeting_id', meetingId);
  }
}


