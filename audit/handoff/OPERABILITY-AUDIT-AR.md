# فحص التشغيل والنشر — المونوريبو بالكامل

**الدور:** مهندس تحقق · **المرجع:** `HEAD = fec4bc8` · `origin/main = d3f8df1`
**التاريخ:** 2026-08-06

> السؤال: **هل يمكن تشغيل هذا النظام ونشره باحتراف؟** كل إجابة من الكود.

---

# ١) 🔴 لا يوجد أمر واحد يشغّل النظام · ولا أمر واحد يختبره

## المُتحقَّق

```bash
node -e "const s=require('./package.json').scripts; console.log(s.dev, s.test)"
# dev:  ❌ غير موجود
# test: ❌ غير موجود
```

## الموجود على الجذر

| السكربت | الحالة |
|---|---|
| `build` | ✅ `typecheck && pnpm -r --if-present run build` |
| `typecheck` | ✅ يغطي كل الحزم |
| `lint` · `lint:website` · `lint:report` | ✅ |
| `confidence` | ✅ `production-confidence-check.mjs` |
| `ops:*` (خمسة) | ✅ website-ci · staging-prep · staging-smoke · soft-launch · live-cutover |
| **`dev`** | 🔴 **غير موجود** |
| **`test`** | 🔴 **غير موجود** |

## الأثر — مثبت بالسابقة

**`pnpm test` على الجذر لا يفعل شيئًا.** من يريد تشغيل كل الاختبارات عليه
أن يعرف مسبقًا:
```bash
pnpm --filter @workspace/api-server   run test
pnpm --filter @workspace/banco-mobile run test
```

**وهذا بالضبط ما أنتج كسر الـ47 ساعة:** `typecheck` موجود على الجذر
فيغطي الكل، و`test` غير موجود فيلجأ الجميع للنطاق الضيق.

| | |
|---|---|
| **Impact** | لا يمكن لمشغّل جديد أن يعرف أنه شغّل كل شيء |
| **Recommendation** | `"test": "pnpm -r --if-present run test"` و`"dev"` منسّق. **قرار المدير** |

---

# ٢) تغطية السكربتات لكل حزمة — مُقاسة

| الحزمة | dev | build | test | typecheck |
|---|---|---|---|---|
| `api-server` | ✅ | ✅ | ✅ | ✅ |
| `banco-mobile` | ✅ | ✅ | ✅ | ✅ |
| `banco-website` | ✅ | ✅ | 🔴 | ✅ |
| `admin-os` | ✅ | ✅ | 🔴 | ✅ |
| `dealer-os` | ✅ | ✅ | 🔴 | ✅ |
| `landing` | ✅ | ✅ | 🔴 | ✅ |

**أربع حزم بلا اختبارات إطلاقًا.** ثلاث منها واجهات يستخدمها الموظفون
والتجار (`admin-os` · `dealer-os`) والمستهلك (`banco-website`).

**ملاحظة متوازنة:** `ci-website.yml` يشغّل **تسع عمليات تدقيق** على الموقع
(`journey-parity` · `seller-workspace-parity` · `market-copy-parity` ·
`responsive-chrome` · `plug-hardening` · `staging-prep` · `soft-launch-prep`
· `rewrite-config` · `seo-static`) — **فالتغطية موجودة خارج `test`.**

---

# ٣) 🚨 إنذار كاذب أسقطته — **الغلط الثالث من نوعه عندي**

| | |
|---|---|
| **Claim الأولي** | «50 متغير بيئة مستعمل وغير موثّق في `.env.example`» |
| **Evidence ضده** | `.env.example:1` → *"environment variable **NAMES only** (no secrets)"* — الملف **بالكامل تعليقات عمدًا** |
| **Verification** | ❌ **الادعاء غير صحيح** |
| **سبب الغلط** | `grep -E "^[A-Z_]+="` على ملف مصمَّم ألا يحتوي `=` إطلاقًا |

## الحقيقة — تصميم سليم

`.env.example` **فهرس أسماء** يوجّه لقوالب كل منصة:

| المنصة | القالب | متغيرات فعلية |
|---|---|---|
| AWS | `deploy/aws/env/.env.production.example` | **33** |
| GCP | `deploy/gcp/env/.env.production.example` | **22** |
| Coolify | `docker-compose.coolify.yml` + `COOLIFY_DEPLOY_NOW.md` | — |
| Replit | `.replit` + `replit.md` | — |
| Mobile EAS | `release/EAS_BUILD.md` | — |

**ويسمّي الإلزامي صراحة:**
```
Coolify compose REQUIRED (API refuses start without these):
  POSTGRES_PASSWORD CLERK_SECRET_KEY SESSION_SECRET PAYMENT_CONFIG_ENCRYPTION_KEY
Core (API will not boot without PORT + DATABASE_URL)
```

**«NEVER commit .env files with real values» مكتوبة في آخر الملف.**

**هذا من أفضل ما في المستودع، لا فجوة فيه.**

---

# ٤) ما لم أستطع إثباته في هذه الجولة

| البند | ما وجدته | الحكم |
|---|---|---|
| «API refuses start» فعليًا | `secretCrypto.ts:36-39` يرمي عند غياب `PAYMENT_CONFIG_ENCRYPTION_KEY` **و**`SESSION_SECRET` — لكنه **كسول** (وقت التشفير) لا عند الإقلاع | ⚠️ **غير مثبت** أنه بوابة إقلاع |
| اكتمال 50 متغيرًا مقابل القوالب | لم أقارن كل متغير بكل قالب | **غير قابل للإثبات بالأدلة الحالية** |

---

# ٥) النشر — الحصيلة المُتحقَّقة

## تكافؤ الأهداف

| الهدف | api | SPAs (admin/dealer/landing) | banco-website |
|---|---|---|---|
| **Coolify** | ✅ | ✅ | ✅ |
| **AWS** | ✅ | ✅ (`Dockerfile.web`) | 🔴 **غير موجود** |
| **GCP** | ✅ | ❌ | ❌ |

**Coolify هو الهدف الوحيد الكامل** — وهو ما توصي به المستندات فعلًا.

## 🔴 ت-١٢ (من الجولة السابقة، ما زال قائمًا)

```yaml
migrate:  profiles: ["migrate"]          # لا تعمل افتراضيًا
api:      depends_on: postgres (healthy) # migrate غير مذكورة
```
**مشغّل ينسى `--profile migrate` يقلع API على schema قديم.**

## ✅ سليم ومُتحقَّق

- `migrate` يطبّق الميجريشن **بالترتيب** لا `push --force`
- سجل `0000→0003` متسلسل بلا انحراف
- الأمر موثّق نصًا في `COOLIFY_DEPLOY_NOW.md:130` و`docs/DEPLOY_COOLIFY.md:219,388`
- الأنواع المسموحة للرفع **allowlist** مع استبعاد `image/svg+xml`
- رفع بلا تحقق خادمي **غير ممكن**

---

# ٦) الخلاصة للمدير

## ما يعمل بشكل احترافي بالفعل ✅
| البند | الدليل |
|---|---|
| `typecheck` من الجذر يغطي كل الحزم | `pnpm -r --filter "./artifacts/**"` |
| `build` مربوط بـ`typecheck` قبله | لا بناء بلا فحص أنواع |
| توثيق البيئة متعدد المنصات ومنظّم | `.env.example` + 5 قوالب |
| تسع عمليات تدقيق للموقع في CI | `ci-website.yml` |
| الميجريشن مرتّبة وموثّقة | `0000→0003` |
| أمان الرفع | allowlist + تحقق خادمي |

## ما ينقص التشغيل 🔴
| # | النقص | الأثر |
|---|---|---|
| 1 | **لا `test` على الجذر** | لا أحد يعرف أنه شغّل كل الاختبارات — **أنتج كسر 47 ساعة** |
| 2 | **لا `dev` على الجذر** | تشغيل النظام يتطلب معرفة مسبقة بست حزم |
| 3 | **4 حزم بلا `test`** | admin-os · dealer-os · landing · banco-website |
| 4 | **`api` لا ينتظر `migrate`** | إقلاع على schema قديم ممكن |
| 5 | **`banco-website` بلا مسار AWS/GCP** | Coolify حصريًا |
| 6 | **صفر أوسمة** | `deploy.yml` (tag-gated) لا يمكن أن يولّع |

---

**لم أعدّل أي كود. لم أتخذ أي قرار معماري.**
**الغلط الثالث من نوعه عندي مسجّل في §3 — الاستدلال بـ`grep` بدل فتح الملف.**

— مهندس التحقق
