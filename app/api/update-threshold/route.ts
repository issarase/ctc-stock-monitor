import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { itemId, minStock } = await request.json();

    if (!itemId || minStock === undefined) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    const { error } = await supabase
      .from('opp_items')
      .update({ min_stock: parseInt(minStock, 10) })
      .eq('id', itemId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'อัปเดตเกณฑ์ขั้นต่ำเรียบร้อยแล้ว' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}