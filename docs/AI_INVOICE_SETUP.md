# قراءة فواتير الشراء بالذكاء الاصطناعي

الميزة تستخدم Supabase Edge Function حتى لا يظهر مفتاح OpenAI في المتصفح.

## إعداد الخدمة

```bash
supabase secrets set OPENAI_API_KEY=your_key_here
supabase secrets set OPENAI_INVOICE_MODEL=gpt-4.1-mini
supabase functions deploy parse-purchase-invoice
```

بعد النشر، افتح صفحة فاتورة شراء جديدة واضغط **قراءة الفاتورة بالذكاء الاصطناعي**. يمكن رفع صورة أو PDF متعدد الصفحات، ثم يجب مراجعة النتائج قبل إضافتها إلى الفاتورة.

المفتاح لا يجب وضعه في `.env` الخاص بالواجهة أو داخل أي ملف يتم رفعه إلى GitHub.
