import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import fetch from 'node-fetch'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
