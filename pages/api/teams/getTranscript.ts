import type { NextApiRequest, NextApiResponse } from 'next';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method Not Allowed');
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = req.query.userId as string;

  if (!token || !userId) {
    return res.status(400).json({ error: 'Missing token or userId' });
  }

  const client = Client.init({
    authProvider: (done) => done(null, token),
  });

  try {
    const callRecords = await client.api('/communications/callRecords').get();
    const record = callRecords.value?.[0];
    const joinWebUrl = record?.joinWebUrl;

    if (!joinWebUrl) {
      return res.status(404).json({ error: 'Join URL not found in call records' });
    }

    const encodedUrl = encodeURIComponent(joinWebUrl);
    const meetingsResp = await client
      .api(`/users/${userId}/onlineMeetings?$filter=joinWebUrl eq '${encodedUrl}'`)
      .get();
    const meeting = meetingsResp.value?.[0];
    if (!meeting?.id) {
      return res.status(404).json({ error: 'Online meeting not found' });
    }

    const transcriptsResp = await client
      .api(`/users/${userId}/onlineMeetings/${meeting.id}/transcripts`)
      .get();
    const transcript = transcriptsResp.value?.[0];
    if (!transcript?.id) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    const transcriptContent = await client
      .api(
        `/users/${userId}/onlineMeetings/${meeting.id}/transcripts/${transcript.id}/content?$format=text/vtt`
      )
      .get();

    res.status(200).send(transcriptContent);
  } catch (error: any) {
    res.status(500).json({ error: 'Graph API error', detail: error.message || error });
  }
}
