import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60; // ขยายเวลาทำงาน Serverless Function เป็น 60 วินาที

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  let browser = null;
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'กรุณาตั้งค่า .env.local ให้ถูกต้องก่อน' }, { status: 400 });
    }

    const { customerName, stockUsername, stockPassword } = await request.json();

    if (!customerName || !stockPassword) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุชื่อลูกค้า และ รหัสผ่านเว็บเดิม' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const isDev = process.env.NODE_ENV === 'development';

    browser = await playwright.launch({
      args: isDev ? ['--ignore-certificate-errors'] : [...chromium.args, '--ignore-certificate-errors'],
      executablePath: isDev ? undefined : await chromium.executablePath(),
      headless: true,
    });

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto('https://tsd.ctc.co.th/ctc_stock_prd/login.php', { waitUntil: 'networkidle', timeout: 30000 });

    await page.fill('input[placeholder*="ชื่อผู้ใช้"], input[name="username"]', stockUsername || 'issarase.l');
    await page.fill('input[placeholder*="รหัสผ่าน"], input[name="password"]', stockPassword);

    const bodyText = await page.innerText('body');
    const matchMath = bodyText.match(/(\d+)\s*([\+\-\*])\s*(\d+)/);

    if (matchMath) {
      const num1 = parseInt(matchMath[1], 10);
      const operator = matchMath[2];
      const num2 = parseInt(matchMath[3], 10);
      let answer = 0;
      if (operator === '+') answer = num1 + num2;
      else if (operator === '-') answer = num1 - num2;
      else if (operator === '*') answer = num1 * num2;
      await page.fill('input[placeholder*="คำตอบ"], input[name*="captcha"]', answer.toString());
    }

    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
      page.click('button:has-text("เข้าสู่ระบบ"), input[type="submit"]')
    ]);

    const stockUrl = `https://tsd.ctc.co.th/ctc_stock_prd/inv_product_list.php?view=grid&per_page=54&stock=in&q=${encodeURIComponent(customerName)}`;
    await page.goto(stockUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const items = await page.$$eval('div', (divs) => {
      const results: any[] = [];
      divs.forEach((div) => {
        const text = div.innerText || '';
        if (text.includes('Stock Code:') && div.querySelectorAll('div').length < 15) {
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          const title = lines[0] || 'อะไหล่ IT';
          const stockCodeMatch = text.match(/Stock Code:\s*([^\n\r]+)/i);
          const stockCode = stockCodeMatch ? stockCodeMatch[1].trim() : `UNK-${Math.random().toString(36).substring(7)}`;
          const locMatch = text.match(/LOCAT1:\s*([^\n\r]+)/i);
          const location = locMatch ? locMatch[1].trim() : '-';
          const remarkMatch = text.match(/Remark:\s*([\s\S]*?)(?=C\d+|$)/i);
          const remark = remarkMatch ? remarkMatch[1].trim() : text;
          const matchStock = text.match(/คงเหลือ:\s*(\d+)/);
          const quantity = matchStock ? parseInt(matchStock[1], 10) : 0;

          if (!results.some(r => r.stockCode === stockCode)) {
            results.push({
              title: title.substring(0, 255),
              stockCode,
              location,
              remark: remark.substring(0, 500),
              quantity
            });
          }
        }
      });
      return results;
    });

    await browser.close();

    const allItems = items.map(item => {
      const extractedOpp = item.remark.match(/Opp\.?\s*(\d+)/i)?.[1] || 'N/A';
      return {
        customer_name: customerName.trim(),
        opp_number: extractedOpp,
        managed_by: stockUsername || 'issarase.l',
        item_name: item.title,
        stock_code: item.stockCode,
        location: item.location,
        remark: item.remark,
        quantity: item.quantity,
        updated_at: new Date().toISOString()
      };
    });

    if (allItems.length > 0) {
      await supabase.from('opp_items').delete().eq('customer_name', customerName.trim()).eq('managed_by', stockUsername);
      const { error } = await supabase.from('opp_items').insert(allItems);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, count: allItems.length });

  } catch (error: any) {
    if (browser) await browser.close();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}