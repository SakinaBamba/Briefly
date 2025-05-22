// pollCallRecords.ts
export {}; // This line makes the file a module so top-level await is allowed

const accessToken = process.env.GRAPH_API_ACCESS_TOKEN;

async function pollCallRecords() {
  if (!accessToken) {
    console.error("Missing GRAPH_API_ACCESS_TOKEN");
    return;
  }

  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch meetings:", await response.text());
      return;
    }

    const data = await response.json();
    console.log("Meetings:", data);

    // Optional: iterate over each meeting and do more with them
    for (const meeting of data.value) {
      console.log(`Meeting: ${meeting.subject}, ID: ${meeting.id}`);
    }
  } catch (error) {
    console.error("Polling failed:", error);
  }
}

// Call the polling function
pollCallRecords();


