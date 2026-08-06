import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    }));

    // 1. ดึงหน้า Login
    const loginUrl = 'https://tsd.ctc.co.th/ctc_stock_prd/login.php';
    const loginPageRes = await client.get(loginUrl);
    const $ = cheerio.load(loginPageRes.data);

    // 2. ดึง Field ทั้งหมดใน <form> (รวม Hidden Input)
    const formData = new URLSearchParams();
    $('form input').each((_, el) => {
      const name = $(el).attr('name');
      const val = $(el).attr('value') || '';
      const type = $(el).attr('type') || 'text';

      if (name) {
        if (type === 'text' && (name.includes('user') || name.includes('username'))) {
          formData.append(name, username);
        } else if (type === 'password') {
          formData.append(name, password);
        } else if (type !== 'submit' && type !== 'button') {
          formData.append(name, val); // hidden inputs
        }
      }
    });

    // 3. คำนวณ CAPTCHA จาก HTML ที่เพิ่งโหลดมา
    const bodyText = $('body').text();
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

    // ใส่คำตอบ CAPTCHA ลงใน Field ที่เกี่ยวข้อง
    let captchaKeyFound = false;
    $('input').each((_, el) => {
      const name = $(el).attr('name') || '';
      if (name.toLowerCase().includes('cap') || name.toLowerCase().includes('ans') || name.toLowerCase().includes('num')) {
        formData.set(name, captchaAnswer);
        captchaKeyFound = true;
      }
    });

    if (!captchaKeyFound) {
      formData.append('captcha', captchaAnswer);
    }

    // พิมพ์ Logs เช็กดูค่าที่ส่งยิงไป
    console.log('--- DEBUG SENT FORM DATA ---');
    console.log('CAPTCHA Math Matched:', matchMath ? `${matchMath[1]} ${matchMath[2]} ${matchMath[3]} = ${captchaAnswer}` : 'NOT FOUND');
    console.log('Form Parameters:', formData.toString());

    // 4. ยิง Submit เข้าสู่ระบบ
    const postRes = await client.post(loginUrl, formData.toString(), {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': loginUrl,
        'Origin': 'https://tsd.ctc.co.th'
      },
      maxRedirects: 5
    });

    const resHtml = postRes.data.toString();
    
    // พิมพ์สั้นๆ เพื่อดูผลลัพธ์การตอบกลับ
    console.log('--- DEBUG RESPONSE HTML LENGTH ---', resHtml.length);
    console.log('Response URL/Title:', $('title', resHtml).text());

    // เช็กเงื่อนไขผ่าน
    const isLoginFailed = resHtml.includes('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') || 
                          resHtml.includes('คำตอบไม่ถูกต้อง') ||
                          (resHtml.includes('login.php') && resHtml.includes('password'));

    if (isLoginFailed) {
      return NextResponse.json({ success: false, error: 'ชื่อผู้ใช้ หรือ รหัสผ่านระบบ CTC ไม่ถูกต้อง' }, { status: 401 });
    }

    return NextResponse.json({ success: true, username });

  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ CTC' }, { status: 500 });
  }
}