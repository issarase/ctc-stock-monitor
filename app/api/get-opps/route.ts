import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Missing Supabase config' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const username = (searchParams.get('username') || '').trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ Username' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ดึงเฉพาะลูกค้าที่เป็นของ username นี้ดูแล
    const { data: userCustomers, error: custError } = await supabase
      .from('user_customers')
      .select('*')
      .eq('username', username);

    if (custError) throw custError;

    const { data: items, error: itemsError } = await supabase
      .from('opp_items')
      .select('*')
      .eq('managed_by', username);

    if (itemsError) throw itemsError;

    const result = (userCustomers || []).map(cust => {
      const customerItems = (items || []).filter(item => item.customer_name === cust.customer_name);
      const oppNumbers = Array.from(new Set(customerItems.map(i => i.opp_number)));

      return {
        customerName: cust.customer_name,
        oppNumbers: oppNumbers,
        items: customerItems
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}