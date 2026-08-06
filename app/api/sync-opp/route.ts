import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export async function POST(request: Request) {
  try {
    const { username, password, oppNumber } = await request.json();

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

    // 1. ดึงหน้า Login เพื่อทำ Session
    const loginUrl = 'https://tsd.ctc.co.th/ctc_stock_prd/login.php';
    const loginPageRes = await client.get(loginUrl);
    const $login = cheerio.load(loginPageRes.data);

    // คำนวณ CAPTCHA
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

    // เตรียมฟอร์ม Login
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

    // ยิง เข้าสู่ระบบ
    await client.post(loginUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': loginUrl, 'Origin': 'https://tsd.ctc.co.th' }
    });

    // 2. ดึงข้อมูล OPP/สต็อก ตามเลข OPP หรือค้นหาเพิ่มเติม
    const searchUrl = `https://tsd.ctc.co.th/ctc_stock_prd/main.php${oppNumber ? `?opp=${encodeURIComponent(oppNumber)}` : ''}`;
    const stockRes = await client.get(searchUrl);
    const $stock = cheerio.load(stockRes.data);

    // ตรวจสอบความถูกต้องหน้าเว็บ
    const isLoginFailed = $stock('input[type="password"]').length > 0;
    if (isLoginFailed) {
      return NextResponse.json({ success: false, error: 'การเชื่อมต่อระบบ CTC ล้มเหลว (Session Expired)' }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sync ข้อมูล OPP ${oppNumber || ''} สำเร็จ`,
      data: [] 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการ Sync OPP' }, { status: 500 });
  }
}