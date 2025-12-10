import { NextResponse } from 'next/server';

/**
 * Debug endpoint to verify environment variables in production
 * DO NOT LEAVE THIS IN PRODUCTION LONG-TERM (exposes partial credentials)
 */
export async function GET() {
  return NextResponse.json({
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
    supabase_url_length: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    service_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anon_key_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    // Show first/last 10 chars to verify it's the right URL
    url_preview: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(process.env.NEXT_PUBLIC_SUPABASE_URL.length - 20)}`
      : 'NOT SET',
  });
}
