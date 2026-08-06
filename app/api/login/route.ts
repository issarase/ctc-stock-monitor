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
    
    // 🎯 แปลง Username เป็นตัวพิมพ์เล็กทั้งหมดเสมอ (toLowerCase)
    const rawUsername = body.username || '';
    const username = rawUsername.trim().toLowerCase();
    const password = (body.password || '').trim();

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

    // 1. ดึงหน้า Login
    const loginUrl = 'https://tsd.ctc.co.th/ctc_stock_prd/login.php';
    const loginPageRes = await client.get(loginUrl);
    const $ = cheerio.load(loginPageRes.data);

    // 2. ดึง Field และคำนวณ CAPTCHA
    const formData = new URLSearchParams();
    $('form input').each((_, el) => {
      const name = $(el).attr('name');
      const val = $(el).attr('value') || '';
      const type = $(el).attr('type') || 'text';

      if (name) {
        if (type === 'text' && (name.includes('user') || name.includes('username'))) formData.append(name, username);
        else if (type === 'password') formData.append(name, password);
        else if (type !== 'submit' && type !== 'button') formData.append(name, val);
      }
    });

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

    $('input').each((_, el) => {
      const name = $(el).attr('name') || '';
      if (name.toLowerCase().includes('cap') || name.toLowerCase().includes('ans') || name.toLowerCase().includes('num')) {
        formData.set(name, captchaAnswer);
      }
    });

    // 3. ยิง Login
    const postRes = await client.post(loginUrl, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': loginUrl, 'Origin': 'https://tsd.ctc.co.th' }
    });

    const resHtml = postRes.data.toString();
    const isLoginFailed = resHtml.includes('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') || 
                          resHtml.includes('คำตอบไม่ถูกต้อง') ||
                          (resHtml.includes('login.php') && resHtml.includes('password'));

    if (isLoginFailed) {
      return NextResponse.json({ success: false, error: 'ชื่อผู้ใช้ หรือ รหัสผ่านระบบ CTC ไม่ถูกต้อง' }, { status: 401 });
    }

    // 💾 4. บันทึก/อัปเดต CTC Credentials ลง Supabase เมื่อล็อกอินสำเร็จ (ใช้ username ตัวเล็กเสมอ)
    await supabase
      .from('user_credentials')
      .upsert({
        username: username,
        ctc_username: username,
        ctc_password: password,
        updated_at: new Date().toISOString()
      }, { onConflict: 'username' });

    return NextResponse.json({ success: true, username });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ CTC' }, { status: 500 });
  }
}