const queueInsertions = [];

for (const record of records.slice(0, 15)) {
  const joinWebUrl = record.joinWebUrl;
  if (!joinWebUrl) continue;

  const filterUrl = new URL(`https://graph.microsoft.com/v1.0/users/${graphUserId}/onlineMeetings`);
  filterUrl.searchParams.set("$filter", `JoinWebUrl eq '${joinWebUrl}'`);

  const meetingRes = await fetch(filterUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const meetingData = await meetingRes.json();
  const meeting = meetingData.value?.[0];
  if (!meeting) continue;

  const meetingId = meeting.id;

  // Check if already in meetings table or queue
  const { data: existing } = await supabase
    .from('meetings')
    .select('id')
    .eq('external_meeting_id', meetingId)
    .maybeSingle();
  if (existing) continue;

  const { data: queued } = await supabase
    .from('meeting_queue')
    .select('id')
    .eq('external_meeting_id', meetingId)
    .maybeSingle();
  if (queued) continue;

  queueInsertions.push({
    external_meeting_id: meetingId,
    join_url: joinWebUrl
  });

  if (queueInsertions.length >= 5) break;
}

if (queueInsertions.length > 0) {
  await supabase.from('meeting_queue').insert(queueInsertions);
}

res.status(200).json({ queued: queueInsertions.length });

