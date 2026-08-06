import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { customerName, username } = await request.json();

    if (!customerName || !username) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // 1. ดึงรายการสินค้าทั้งหมดในโครงการนี้จาก opp_items
    const { data: items, error: fetchErr } = await supabase
      .from('opp_items')
      .select('*')
      .eq('customer_name', customerName)
      .eq('managed_by', username);

    if (fetchErr) throw fetchErr;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'ไม่พบรายการสินค้าในโครงการนี้' });
    }

    let updatedCount = 0;

    // 2. วน Loop อัปเดตสต็อกสดแต่ละ Part Number
    for (const item of items) {
      // ค้นหาสต็อกสดล่าสุดจากตารางกลาง หรือ Web Stock API ตาม stock_code
      const searchPattern = `%${item.stock_code}%`;
      
      const { data: latestStock } = await supabase
        .from('opp_items')
        .select('quantity, location, item_name, opp_number')
        .ilike('stock_code', searchPattern)
        .neq('customer_name', customerName) // เลี่ยงการดึงค่าตัวเอง
        .limit(1);

      if (latestStock && latestStock.length > 0) {
        const fresh = latestStock[0];
        
        // อัปเดตข้อมูลสดกลับเข้ารายการโครงการ
        await supabase
          .from('opp_items')
          .update({
            quantity: fresh.quantity ?? item.quantity,
            location: fresh.location || item.location,
            item_name: fresh.item_name || item.item_name,
            opp_number: fresh.opp_number || item.opp_number,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      count: items.length,
      updatedCount: updatedCount,
      message: `อัปเดตสต็อกสดสำเร็จ (${updatedCount}/${items.length} รายการ)`
    });

  } catch (error: any) {
    console.error('Error in resync-excel:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}