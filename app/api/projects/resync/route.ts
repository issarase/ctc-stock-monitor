import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'ไม่พบ Project ID' }, { status: 400 });
    }

    // 1. ดึงรายการในโครงการนี้
    const { data: items, error: fetchErr } = await supabase
      .from('project_items')
      .select('*')
      .eq('project_id', projectId);

    if (fetchErr) throw fetchErr;

    // 2. วน Loop เช็กสต็อกสดใหม่ทุกตัว
    for (const item of items || []) {
      const { data: matchedStock } = await supabase
        .from('opp_items')
        .select('quantity')
        .eq('stock_code', item.part_number)
        .maybeSingle();

      let status = 'PENDING';
      let shortageQty = 0;

      if (!matchedStock) {
        status = 'NEW_PART';
        shortageQty = item.required_qty;
      } else {
        const availableStock = matchedStock.quantity || 0;
        if (availableStock >= item.required_qty) {
          status = 'READY';
          shortageQty = 0;
        } else {
          status = 'SHORTAGE';
          shortageQty = item.required_qty - availableStock;
        }
      }

      // อัปเดตสถานะและจำนวนขาดลง project_items
      await supabase
        .from('project_items')
        .update({ status, shortage_qty: shortageQty })
        .eq('id', item.id);
    }

    return NextResponse.json({ success: true, message: 'ดึงสต็อกสดเฉพาะโครงการสำเร็จ' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}