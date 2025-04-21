import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false
  }
}

import formidable from 'formidable'
import fs from 'fs'

// Setup Supabase Admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⛔ This should be secret and stored in Vercel
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const form = new formidable.IncomingForm()

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Failed to parse form' })

    const opportunity_id = fields.opportunity_id?.[0]
    const file = files.file?.[0]

    if (!opportunity_id || !file) {
      return res.status(400).json({ error: 'Missing opportunity_id or file' })
    }

    const fileStream = fs.createReadStream(file.filepath)
    const path = `${opportunity_id}/${file.originalFilename}`

    const { error: uploadError } = await supabase.storage
      .from('opportunity-files')
      .upload(path, fileStream, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true
      })

    if (uploadError) {
      return res.status(500).json({ error: 'Upload failed', details: uploadError.message })
    }

    const { error: insertError } = await supabase.from('opportunity_files').insert({
      opportunity_id,
      file_name: file.originalFilename,
      storage_path: path
    })

    if (insertError) {
      return res.status(500).json({ error: 'Failed to save metadata', details: insertError.message })
    }

    return res.status(200).json({ message: 'File uploaded successfully' })
  })
}
