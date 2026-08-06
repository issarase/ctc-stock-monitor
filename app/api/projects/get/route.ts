import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // ดึงข้อมูลโครงการพร้อมรายการสินค้าในโครงการนั้นๆ
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id,
        project_name,
        created_at,
        project_items (
          id,
          part_number,
          required_qty,
          shortage_qty,
          status,
          source_type
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}