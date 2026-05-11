# YOUSF1 — منصة التداول الاحترافية 🚀

> React 18 · Node.js · MongoDB · Binance API · GitHub Pages · Render

---

## 📁 هيكل المشروع الكامل

```
YOUSF1/                          ← المجلد الرئيسي (GitHub Repository)
│
├── .github/
│   └── workflows/
│       └── deploy.yml           ← GitHub Actions (Auto Deploy)
│
├── frontend/                    ← React App
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.js
│   │   └── App.jsx              ← الكود الكامل للواجهة
│   └── package.json             ← يحتوي على "homepage" + "gh-pages"
│
├── backend/                     ← Node.js Server
│   ├── server.js
│   ├── package.json
│   ├── .env                     ← لا ترفعه على GitHub
│   ├── render.yaml
│   └── db/
│       └── seed.js
│
└── README.md
```

---

## ⚡ تشغيل المشروع محلياً (5 دقائق)

### الخطوة 1 — تثبيت MongoDB محلياً

```bash
# macOS
brew install mongodb-community && brew services start mongodb-community

# Ubuntu
sudo apt install mongodb && sudo systemctl start mongodb

# Windows → نزّل من: https://www.mongodb.com/try/download/community
```

### الخطوة 2 — إعداد السيرفر (Backend)

```bash
cd backend

# إنشاء ملف .env
cat > .env << 'EOF'
BINANCE_API_KEY=ضع_مفتاحك_هنا
BINANCE_SECRET_KEY=ضع_المفتاح_السري_هنا
DB_URI=mongodb://localhost:27017/YOUSF1
PORT=5000
JWT_SECRET=yousf1_super_secret_change_me_in_production
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
EOF

# تثبيت المكتبات
npm install

# زرع بيانات تجريبية (اختياري)
node db/seed.js
# → يُنشئ: demo@yousf1.com / demo1234

# تشغيل السيرفر
node server.js
# أو للتطوير:
npm run dev
```

### الخطوة 3 — إعداد الواجهة (Frontend)

```bash
cd frontend

# تثبيت المكتبات
npm install

# تشغيل الواجهة
npm start
# → يفتح على: http://localhost:3000
```

---

## 🌐 النشر على الإنترنت

### 📋 المتطلبات الأساسية

| الأداة | الرابط | الوقت |
|--------|--------|-------|
| حساب GitHub | [github.com](https://github.com) | 2 دقيقة |
| حساب Render | [render.com](https://render.com) | 2 دقيقة |
| حساب MongoDB Atlas | [cloud.mongodb.com](https://cloud.mongodb.com) | 3 دقائق |

---

### 🍃 الخطوة 1 — MongoDB Atlas (قاعدة البيانات)

1. اذهب لـ [cloud.mongodb.com](https://cloud.mongodb.com) → أنشئ حساب
2. **Build a Database** → **M0 FREE** → اختر Region → Create
3. **Database Access** → Add User → احفظ username/password
4. **Network Access** → Add IP → **0.0.0.0/0** (السماح لكل الـ IPs)
5. **Connect** → Drivers → انسخ Connection String:

```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/YOUSF1
```

---

### ⚡ الخطوة 2 — Render (السيرفر)

1. اذهب لـ [render.com](https://render.com) → سجّل بحساب GitHub
2. **New +** → **Web Service** → اربط repo الـ Backend
3. الإعدادات:
   ```
   Name:          yousf1-api
   Root Dir:      backend        ← مهم إذا Backend في مجلد فرعي
   Build Command: npm install
   Start Command: node server.js
   Plan:          Free
   ```
4. **Environment Variables** → أضف:

   | Key | Value |
   |-----|-------|
   | `DB_URI` | `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/YOUSF1` |
   | `JWT_SECRET` | كلمة سرية طويلة عشوائية |
   | `BINANCE_API_KEY` | مفتاح Binance |
   | `BINANCE_SECRET_KEY` | المفتاح السري |
   | `PORT` | `10000` |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | `https://YOUR_USERNAME.github.io/YOUSF1` |

5. **Create Web Service** → انتظر 3 دقائق

   ✅ ستحصل على: `https://yousf1-api.onrender.com`

   تحقق: `https://yousf1-api.onrender.com/api/health` → يجب أن يرد بـ `{"status":"OK"}`

---

### 🐙 الخطوة 3 — GitHub Pages (الواجهة)

#### الطريقة أ — يدوياً (أسرع)

```bash
cd frontend

# 1. عدّل package.json → homepage
# غيّر: "homepage": "https://YOUR_USERNAME.github.io/YOUSF1"
# إلى:  "homepage": "https://yousef123.github.io/YOUSF1"

# 2. أنشئ ملف .env.production
echo "REACT_APP_API_URL=https://yousf1-api.onrender.com/api" > .env.production
echo "REACT_APP_WS_URL=wss://yousf1-api.onrender.com" >> .env.production

# 3. ابنِ ونشر
npm run build
npm run deploy
```

✅ ستحصل على: `https://YOUR_USERNAME.github.io/YOUSF1`

#### الطريقة ب — تلقائياً بـ GitHub Actions

1. ارفع المشروع الكامل على GitHub
2. اذهب لـ **Settings → Secrets → Actions** → أضف:
   - `REACT_APP_API_URL` = `https://yousf1-api.onrender.com/api`
   - `REACT_APP_WS_URL`  = `wss://yousf1-api.onrender.com`
   - `RENDER_DEPLOY_HOOK` = الـ Hook URL من Render → Settings
3. كل `git push` على `main` → يُعيد النشر تلقائياً ✨

---

## 🔗 الروابط النهائية

بعد إتمام الخطوات:

```
الواجهة:  https://YOUR_USERNAME.github.io/YOUSF1
السيرفر:  https://yousf1-api.onrender.com
Health:   https://yousf1-api.onrender.com/api/health
```

---

## 🌐 API Endpoints

### المصادقة
| Method | Endpoint | الوصف |
|--------|----------|-------|
| `POST` | `/api/auth/register` | تسجيل مستخدم جديد |
| `POST` | `/api/auth/login` | تسجيل الدخول |

### Binance
| Method | Endpoint | الوصف |
|--------|----------|-------|
| `POST` | `/api/binance/connect` | ربط مفاتيح API (حفظ في DB) |
| `GET`  | `/api/binance/prices` | أسعار جميع الأزواج |
| `GET`  | `/api/binance/klines` | الشموع البيانية |
| `POST` | `/api/binance/deposit` | إيداع USDT |
| `POST` | `/api/binance/withdraw` | سحب USDT |

### التداول
| Method | Endpoint | الوصف |
|--------|----------|-------|
| `POST` | `/api/trades/open` | فتح صفقة |
| `POST` | `/api/trades/close/:id` | إغلاق صفقة |
| `GET`  | `/api/trades/open` | الصفقات المفتوحة |
| `GET`  | `/api/trades/history` | سجل الصفقات |
| `GET`  | `/api/trades/stats` | الإحصائيات |

---

## 🔌 WebSocket

```javascript
const ws = new WebSocket("wss://yousf1-api.onrender.com");
ws.onmessage = (e) => {
  const { data: { s, p } } = JSON.parse(e.data);
  // s = "BTCUSDT", p = "67432.00"
};
```

---

## 🔐 الأمان

| الميزة | التفاصيل |
|--------|---------|
| ✅ JWT Authentication | توكن 7 أيام |
| ✅ bcrypt Password Hashing | 12 rounds |
| ✅ HTTPS/SSL | تلقائي على Render + GitHub Pages |
| ✅ مفاتيح Binance | مشفرة في MongoDB، غير مرئية في الواجهة |
| ✅ CORS | محدود لرابط الـ Frontend فقط |
| ✅ Security Headers | X-Frame-Options, X-XSS-Protection |
| ✅ .env | لا تُرفع أبداً على GitHub |

---

## 💻 المتطلبات

- **Node.js** >= 18.0.0
- **MongoDB** >= 6.0 (أو Atlas مجاناً)
- **حساب Binance** (للـ API الحقيقي — اختياري، يعمل بدونه بوضع تجريبي)

---

## 🚨 ملاحظات مهمة

> ⚠️ **Render Free Plan**: السيرفر ينام بعد 15 دقيقة من عدم الاستخدام. أول طلب قد يأخذ 30-60 ثانية.  
> ⚠️ **GitHub Pages**: للواجهة فقط (Static). السيرفر يجب أن يكون على Render أو Heroku.  
> ⚠️ **.env file**: لا ترفعه أبداً على GitHub — مُضاف في .gitignore.  

---

**YOUSF1 v2.0.0** | React + Node.js + MongoDB + Binance API | MIT License
