import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { createClient } from '@supabase/supabase-js';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = body.username || body.managed_by || 'issarase.l';
    const customerName = (body.customerName || body.customer_name || body.customerId || '').trim();

    if (!username || !customerName) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ Username และชื่อลูกค้า/โครงการ' }, { status: 400 });
    }

    // 1. ดึง CTC Credentials
    const { data: creds } = await supabase
      .from('user_credentials')
      .select('ctc_username, ctc_password')
      .eq('username', username)
      .single();

    if (!creds) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลรหัสผ่าน CTC กรุณาเข้าสู่ระบบใหม่อีกครั้ง' }, { status: 401 });
    }

    const jar = new CookieJar();
    const client = wrapper(axios.create({ 
      jar, 
      withCredentials: true, 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    }));

    // 2. Login CTC
    const loginUrl = 'https://tsd.ctc.co.th/ctc_stock_prd/login.php';
    const loginPageRes = await client.get(loginUrl);
    const $login = cheerio.load(loginPageRes.data);

    const bodyText = $login('body').text();
    const matchMath = bodyText.match(/(\d+)\s*([\+\-\*])\s*(\d+)/);

    let captchaAnswer = '0';
    if (matchMath) {
      const num1 = parseInt(matchMath[1], 10);
      const operator = matchMath[2];
      const num2 = parseInt(matchMath[3], 10);
      if (operator === '+') captchaAnswer = (num1 + num2).toString();
      else if (operator === '-') captchaAnswer = (num1 - num2).toString();
      else if (operator === '*') captchaAnswer = (num1 * num2).toString();
    }

    const formData = new URLSearchParams();
    $login('form input').each((_, el) => {
      const name = $login(el).attr('name');
      const val = $login(el).attr('value') || '';
      const type = $login(el).attr('type') || 'text';

      if (name) {
        if (type === 'text' && (name.includes('user') || name.includes('username'))) formData.append(name, creds.ctc_username);
        else if (type === 'password') formData.append(name, creds.ctc_password);
        else if (type !== 'submit' && type !== 'button') formData.append(name, val);
      }
    });

    $login('input').each((_, el) => {
      const name = $login(el).attr('name') || '';
      if (name.toLowerCase().includes('cap') || name.toLowerCase().includes('ans') || name.toLowerCase().includes('num')) {
        formData.set(name, captchaAnswer);
      }
    });

    await client.post(loginUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': loginUrl, 'Origin': 'https://tsd.ctc.co.th' }
    });

    // 3. ดึงเลข OPP เดิมจาก DB หรือใช้ชื่อลูกค้าค้นหา
    const { data: existingItems } = await supabase
      .from('opp_items')
      .select('opp_number')
      .eq('customer_name', customerName)
      .eq('managed_by', username);

    //let searchQuery = customerName;
    //if (existingItems && existingItems.length > 0) {
    //  const validOpp = existingItems.find(i => i.opp_number && i.opp_number !== 'N/A')?.opp_number;
    //  if (validOpp) searchQuery = validOpp;
    //}

    // ✅ ให้ใช้ชื่อการ์ด (customerName) ค้นหาตรงๆ เสมอ:
    const searchQuery = customerName;

    // 🎯 4. ยิง per_page=52 พร้อมกัน 2 หน้าแบบขนาน (Page 1 และ Page 2)
    const pagesToFetch = [1, 2];
    const fetchPromises = pagesToFetch.map(p => {
      const targetUrl = `https://tsd.ctc.co.th/ctc_stock_prd/inv_product_list.php?view=grid&per_page=52&stock=in&q=${encodeURIComponent(searchQuery)}&page=${p}`;
      return client.get(targetUrl).catch(() => null);
    });

    const pageResponses = await Promise.all(fetchPromises);

    // 5. แกะข้อมูลจากทุกหน้ารวมกัน
    const scrapedItems: any[] = [];

    pageResponses.forEach(res => {
      if (!res || !res.data) return;
      const $stock = cheerio.load(res.data);

      $stock('body *').each((_, el) => {
        const text = $stock(el).text();
        
        if (text.includes('Stock Code:') && text.length < 1200) {
          const stockCodeMatch = text.match(/Stock Code:\s*([^\n\r]+)/i);
          const qtyMatch = text.match(/คงเหลือ:\s*(\d+)/i);
          const locMatch = text.match(/LOCAT1:\s*([^\n\r]+)/i);
          const oppMatch = text.match(/Opp\.?\s*(\d+)/i);

          const stockCode = stockCodeMatch ? stockCodeMatch[1].trim() : '';

          if (stockCode && !scrapedItems.some(item => item.stockCode === stockCode)) {
            const cleanText = text
              .replace(/พร้อมใช้(งาน)?/g, '')
              .replace(/Show\s*\d+\s*entries/gi, '')
              .trim();

            const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
            let realTitle = lines[0] || 'อะไหล่ CTC';
            if (realTitle.startsWith('Stock Code') && lines.length > 1) {
              realTitle = lines[1];
            }

            scrapedItems.push({
              name: realTitle,
              stockCode,
              oppNumber: oppMatch ? oppMatch[1].trim() : 'N/A',
              quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
              location: locMatch ? locMatch[1].trim() : 'N/A',
              remark: text.trim().substring(0, 300)
            });
          }
        }
      });
    });

    // 💾 6. อัปเดตตาราง opp_items
    if (scrapedItems.length > 0) {
      const itemsToInsert = scrapedItems.map(item => ({
        customer_name: customerName,
        opp_number: item.oppNumber,
        managed_by: username,
        item_name: item.name,
        stock_code: item.stockCode,
        location: item.location,
        remark: item.remark,
        quantity: item.quantity,
        updated_at: new Date().toISOString()
      }));

      await supabase.from('opp_items').delete().eq('customer_name', customerName).eq('managed_by', username);
      await supabase.from('opp_items').insert(itemsToInsert);
    }

    const totalFound = scrapedItems.length;

    return NextResponse.json({ 
      success: true, 
      message: `อัปเดตสต็อกสดเรียบร้อยแล้ว`,
      totalItemsFound: totalFound,
      count: totalFound,
      updatedCount: totalFound,
      items: scrapedItems
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงสต็อกสด' }, { status: 500 });
  }
}