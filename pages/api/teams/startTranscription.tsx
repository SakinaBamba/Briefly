import { useEffect } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';


export default function StartTranscription() {
  useEffect(() => {
    microsoftTeams.app.initialize().then(() => {
      microsoftTeams.authentication.getAuthToken({
        successCallback: (token) => {
          fetch('/api/teams/startTranscription', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        },
        failureCallback: (error) => {
          console.error('Token fetch failed', error);
        },
      });
    });
  }, []);

  return <div>Starting transcription...</div>;
}

