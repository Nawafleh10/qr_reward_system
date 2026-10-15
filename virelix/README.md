# Virelix

بديل جهاز النداء (البيجر) للكافيهات والمطاعم، بدون أي جهاز وبدون تطبيق.

1. الكاشير يفتح `/staff.html` ويضغط **+ طلب جديد** → يطلع رقم الطلب وQR.
2. الزبون يمسح الـ QR بكاميرا جواله → صفحة ويب فيها رقمه وحالة طلبه (استلمناه / بالتحضير / جاهز) لحظياً.
3. الكاشير يضغط **ابدأ التحضير** ثم **جاهز ✓** → جوال الزبون يهتز ويرن وتظهر «طلبك جاهز!».

## Run

```bash
cd virelix
cp .env.example .env     # set PUBLIC_BASE_URL to your LAN IP / domain (not localhost) and STAFF_PIN
npm install
npm start                # http://localhost:4100/staff.html
```

- Live updates use Server-Sent Events; storage is a local `data.json` (orders older than 24h are pruned, numbering restarts daily).
- Customer alerts: vibration, sound, browser notification, flashing tab title, screen wake lock. Sound/vibration are armed by the "فعّل التنبيه" tap (browser rules). iOS Safari doesn't vibrate; the sound + on-screen alert still work while the page is open.
- For production, host it over HTTPS (needed for notifications) and swap `data.json` for a real DB if you run more than one instance.
