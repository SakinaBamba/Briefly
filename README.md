# Briefly

Briefly is a Next.js application that integrates with Microsoft Teams and Supabase to generate AI-powered summaries and proposals.

## Development setup

1. Install [Node.js](https://nodejs.org/) (version 18 or later recommended).
2. Clone this repository and install dependencies:

   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in the required values (see the list below).
4. Start the development server:

   ```bash
   npm run dev
   ```

## Environment variables

The application expects the following variables, typically provided through a `.env.local` file:

- `NEXT_PUBLIC_SUPABASE_URL` – your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` – Supabase service role key
- `AZURE_TENANT_ID` – Azure tenant ID for Microsoft Graph
- `AZURE_CLIENT_ID` – Azure app client ID
- `AZURE_CLIENT_SECRET` – Azure app client secret
- `NEXT_PUBLIC_BASE_URL` – public base URL of the app
- `NEXT_PUBLIC_APP_URL` – application URL used by clients
- `OPENAI_API_KEY` – key for OpenAI API access

Refer to `.env.example` for an example configuration.

## Running locally

After setting up the environment variables, run the development server with:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

For a production build, use:

```bash
npm run build
npm start
```

## Deploying on Vercel

1. [Create a Vercel account](https://vercel.com/) and import this repository.
2. In the Vercel dashboard, configure the environment variables listed above.
3. Trigger a deployment. Vercel will build and host the application automatically.

Once deployed, your Vercel URL should be used for `NEXT_PUBLIC_BASE_URL` and `NEXT_PUBLIC_APP_URL`.
