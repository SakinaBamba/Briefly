// File: pages/teams/startTranscription.tsx

import { useEffect } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';

export default function StartTranscription() {
  useEffect(() => {
    microsoftTeams.initialize();

    microsoftTeams.authentication.getAuthToken({
      successCallback: async (token) => {
        const url = new URL(window.location.href);
        const callId = url.searchParams.get('callId');

        const res = await fetch('/api/teams/startTranscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ssoToken: token, callId }),
        });

        if (res.ok) {
          microsoftTeams.tasks.submitTask({ result: 'success' });
        } else {
          const err = await res.json();
          microsoftTeams.tasks.submitTask({ error: err.error || 'API call failed' });
        }
      },
      failureCallback: (err) => {
        console.error('Failed to get SSO token:', err);
        microsoftTeams.tasks.submitTask({ error: err });
      }
    });
  }, []);

  return <div>Starting transcription...</div>;
}

