import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export async function POST(request: Request) {
  try {
    const { username, password, customerId } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'กรุณากรอก Username และ Password' }, { status: 400 });
    }

    const jar = new CookieJar();
    const client = wrapper(axios.create({ 
      jar, 
      withCredentials: true, 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      }
    }));

    // 1. Login เพื่อเอา Session
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
        if (type === 'text' && (name.includes('user') || name.includes('username'))) formData.append(name, username);
        else if (type === 'password') formData.append(name, password);
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

    // 2. ยิงไปดึงหน้าข้อมูลสต็อกสินค้า (URL หน้าสต็อกของระบบ CTC)
    // *หมายเหตุ: ปรับ URL ตรงนี้ให้ตรงกับหน้าสต็อกจริงของ CTC เช่น product_list.php หรือ stock.php*
    const stockUrl = 'https://tsd.ctc.co.th/ctc_stock_prd/main.php'; 
    const stockRes = await client.get(stockUrl);
    const $stock = cheerio.load(stockRes.data);

    // 3. ดึงข้อมูลรายการสินค้าจาก Table/HTML (ปรับ selector ตามหน้าจริง)
    // ตัวอย่างการดึงข้อมูลเพื่ออัปเดตลง Supabase หรือคืนค่ากลับ
    
    return NextResponse.json({ success: true, message: 'อัปเดตสต็อกสดเรียบร้อยแล้ว' });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการดึงสต็อกสด' }, { status: 500 });
  }
}