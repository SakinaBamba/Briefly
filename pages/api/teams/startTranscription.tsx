import { useEffect } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-react';

export const supabase = createBrowserSupabaseClient();



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

