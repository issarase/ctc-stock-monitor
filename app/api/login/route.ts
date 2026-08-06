import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';

export async function POST(request: Request) {
  let browser = null;
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'กรุณากรอก Username และ Password' }, { status: 400 });
    }

    const isDev = process.env.NODE_ENV === 'development';

    browser = await playwright.launch({
      args: isDev ? ['--ignore-certificate-errors'] : [...chromium.args, '--ignore-certificate-errors'],
      executablePath: isDev ? undefined : await chromium.executablePath(),
      headless: true,
    });

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto('https://tsd.ctc.co.th/ctc_stock_prd/login.php', { waitUntil: 'networkidle', timeout: 30000 });

    await page.fill('input[placeholder*="ชื่อผู้ใช้"], input[name="username"]', username);
    await page.fill('input[placeholder*="รหัสผ่าน"], input[name="password"]', password);

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

    const pageContent = await page.content();
    if (page.url().includes('login.php') || (pageContent.includes('ชื่อผู้ใช้') && pageContent.includes('รหัสผ่าน'))) {
      await browser.close();
      return NextResponse.json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านระบบ CTC ไม่ถูกต้อง' }, { status: 401 });
    }

    await browser.close();
    return NextResponse.json({ success: true, username });

  } catch (error: any) {
    if (browser) await browser.close();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}