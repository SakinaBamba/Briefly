import { useEffect } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);




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

