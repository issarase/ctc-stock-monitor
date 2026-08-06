import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const username = (formData.get('username') as string || 'issarase.l').trim().toLowerCase();

    if (!file) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด' }, { status: 400 });
    }

    // 1. อ่านไฟล์ Excel
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);

    // 2. เติม prefix คำว่า "โครงการ " ไว้หน้าชื่อไฟล์เสมอ เพื่อให้ระบบแยกแยะการ์ด Excel ได้ 100%
    const rawFileName = file.name.replace(/\.[^/.]+$/, "").trim();
    const customerName = rawFileName.startsWith('โครงการ') ? rawFileName : `โครงการ ${rawFileName}`;

    // 3. อ่าน Part Number และ Qty จาก Excel
    const itemsToProcess: { keyword: string; minStock: number }[] = [];

    for (const row of sheetData) {
      const keys = Object.keys(row);
      const partKey = keys.find(k => 
        ['part number', 'partnumber', 'part_number', 'stock_code', 'stockcode', 'รหัสสินค้า', 'part'].includes(k.toLowerCase().trim())
      );
      const qtyKey = keys.find(k => 
        ['qty', 'quantity', 'จำนวน', 'จำนวนที่ใช้'].includes(k.toLowerCase().trim())
      );

      const keyword = partKey && row[partKey] ? row[partKey].toString().trim() : '';
      const qty = qtyKey && row[qtyKey] ? parseInt(row[qtyKey], 10) || 1 : 1;

      if (keyword) {
        itemsToProcess.push({ keyword, minStock: qty });
      }
    }

    if (itemsToProcess.length === 0) {
      return NextResponse.json({ error: 'ไม่พบ Part Number ในไฟล์ Excel' }, { status: 400 });
    }

    // 4. ผูกโครงการเข้ากับ user ในตาราง user_customers (ถ้ายังไม่มี)
    const { data: existingUserCust } = await supabase
      .from('user_customers')
      .select('*')
      .eq('username', username)
      .eq('customer_name', customerName)
      .maybeSingle();

    if (!existingUserCust) {
      const { error: userCustError } = await supabase
        .from('user_customers')
        .insert([{ username: username, customer_name: customerName }]);

      if (userCustError) {
        console.error('Error inserting user_customers:', userCustError);
        throw userCustError;
      }
    }

    // 5. เคลียร์รายการเก่าของโครงการนี้ใน opp_items ก่อน (ถ้ามี)
    await supabase
      .from('opp_items')
      .delete()
      .eq('customer_name', customerName)
      .eq('managed_by', username);

    // 6. ค้นหาข้อมูลสินค้าและเตรียมแถว Insert เข้า opp_items
    const rowsToInsert = [];

    for (const item of itemsToProcess) {
      const searchPattern = `%${item.keyword}%`;
      const { data: matchedStocks } = await supabase
        .from('opp_items')
        .select('*')
        .ilike('stock_code', searchPattern)
        .limit(1);

      const matched = matchedStocks && matchedStocks.length > 0 ? matchedStocks[0] : null;

      rowsToInsert.push({
        managed_by: username,
        customer_name: customerName,
        stock_code: matched?.stock_code || item.keyword,
        item_name: matched?.item_name || item.keyword,
        opp_number: matched?.opp_number || 'N/A',
        quantity: matched?.quantity || 0,
        location: matched?.location || '-',
        min_stock: item.minStock,
        updated_at: new Date().toISOString()
      });
    }

    // 7. Insert ข้อมูลลง opp_items
    const { error: insertError } = await supabase
      .from('opp_items')
      .insert(rowsToInsert);

    if (insertError) {
      console.error('Supabase Insert Error:', insertError);
      return NextResponse.json({ error: `บันทึกไม่สำเร็จ: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `นำเข้า${customerName} สำเร็จ (${rowsToInsert.length} รายการ)!`,
      totalItems: rowsToInsert.length 
    });

  } catch (error: any) {
    console.error('Error uploading Excel:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}