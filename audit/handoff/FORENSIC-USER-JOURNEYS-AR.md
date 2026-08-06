# تحقيق جنائي — رحلات المستخدم

**الدور:** مهندس تحقق · **المرجع:** `HEAD = ad394bd` · `origin/main = d3f8df1`
**التاريخ:** 2026-08-06 · الشجرة نضيفة

> كل رقم تحت مقروء من الكود على HEAD. **ما لم أتحقق منه معلَّم صراحة.**

---

# ١) رحلة إنشاء الحساب

| الطبقة | الملف | الحالة |
|---|---|---|
| نقاط الدخول | `app/(auth)/sign-in.tsx` · `sign-up.tsx` | ✅ موجودة |
| المزامنة للخادم | `UserService.getOrCreateUser(clerkId, {name,email})` | ✅ `:25` |
| قراءة المستخدم | `getDbUser(clerkId)` | ✅ `:86` |
| مزامنة الدور لـClerk | `syncRoleToClerk` | ✅ `:100` |
| تحديث الملف | `updateUserProfile` | ✅ `:144` |
| حذف الحساب | `deleteAccount` | ✅ `:301` |

**Verification:** ✅ الرحلة مكتملة من الطرفين.

---

# ٢) 🔬 الميديا — الصور والفيديو

## الأرقام الفعلية

| الحد | القيمة | المصدر |
|---|---|---|
| `MAX_IMAGE_BYTES` | **15 MB** | `ListingService.ts:100` |
| `MAX_VIDEO_BYTES` | **50 MB** | `ListingService.ts:44` |
| أقصى بُعد للصورة | **2048 px** | `upload.ts:13` |
| جودة JPEG | **0.85** | `upload.ts:14` |
| مهلة رفع صورة | **60 ث** | `upload.ts:24` |
| مهلة رفع فيديو | **300 ث** | `upload.ts:25` |
| محاولات الرفع | **3** | `upload.ts:26` |
| مهلة طلب الرابط | **30 ث** · 3 محاولات | `upload.ts:57-58` |

## قائمة الأنواع المسموحة — **allowlist مش denylist**

```
image/jpeg · image/jpg · image/png · image/gif · image/webp · image/avif · image/heic
video/mp4 · video/webm · video/ogg · video/quicktime
```

**ممنوع صراحة** (تعليق `uploadController.ts:34`):
`text/html` · `text/javascript` · `application/javascript` · **`image/svg+xml`**

**Verification:** ✅ **قرار أمني سليم.** `image/svg+xml` ناقل XSS معروف —
استبعاده متعمد وموثّق.

## التحقق من الخادم

`POST /v1/uploads/verify` → `verifyUploadHandler` (`uploadController.ts:329`)
- يقرأ `meta.contentType` ويصنّف صورة/فيديو
- **`meta.size == null` → رفض** — «حجم مفقود يعني لا يمكن التحقق»
- رسالة الفشل للمستخدم: *"Could not verify uploaded media. Please re-upload"*

**Verification:** ✅ **رفع بلا تحقق غير ممكن.** الرابط موقّع مسبقًا،
والخادم يفحص الكائن بعد الرفع.

## معالجة العميل قبل الرفع

`upload.ts:182-204` — أي صورة أطول ضلع فيها > 2048 تُصغَّر، PNG الذي لا
يحتاج شفافية يُحوَّل. **يقلل الفشل على الشبكات الضعيفة قبل أن يحدث.**

---

# ٣) 🔬 رحلة النشر — الحد الإلزامي

## الخادم — `ListingService.validateAttributes:145`

```ts
const required: Record<string, string[]> = {
  car:         ["condition"],
  real_estate: ["area"],
  industrial:  ["capacity"],
};
```

**وإضافات شرطية للعقارات (`:176-186`):**
- `offer_type` + `property_type` — **دائمًا**
- `rooms` — إلا للأرض والوحدات التجارية الخام
- `rental_term` — فقط إذا `offer_type === "rent"`

## الميديا إلزامية

```
ListingService.ts:259  → "At least one media file is required"
ListingService.ts:1205 → نفس القيد في مسار ثانٍ
```
**Verification:** ✅ **لا يمكن نشر إعلان بلا وسيط واحد على الأقل.**

## الموبايل — `constants/listingCreateTaxonomy.ts:373`

`requiredSpecKeysFor(ui, specs)` — والموثّق في ترويسة الملف (`:20-22`):
```
real_estate → area, rooms, property_type, finishing
industrial  → capacity, industry, industrial_type
car         → mileage, year, condition, fuel_type
```

**الموبايل يطلب أكثر من الخادم** — وهذا **الاتجاه الآمن**: العميل أصرم،
فلا يصل للخادم طلب ناقص.

---

# ٤) 🔴 خطر مثبت — مصدران للحد الإلزامي، والتزامن **بتعليق**

| | |
|---|---|
| **Claim** | قاعدة الحقول الإلزامية مطبَّقة مرتين، والاتساق غير محروس آليًا |
| **Evidence** | `ListingService.ts:177` نصًا: `// (KEEP IN SYNC with mobile requiredSpecKeysFor)` |
| **Files** | `api-server/src/services/ListingService.ts` · `banco-mobile/constants/listingCreateTaxonomy.ts` |
| **Verification** | ✅ **مثبت على HEAD** |
| **السابقة** | نفس الصنف تسبب في باج مانع للنشر — `7bde362`: «`create.tsx` كان له **مصدران للحقيقة** لكلمة مطلوب» |
| **Impact** | أي تعديل في جانب دون الآخر → إما رفض متأخر من الخادم، أو حقل يُطلب بلا داعٍ |
| **Recommendation** | حارس يقرأ التطبيقين ويقارنهما — كما يفعل `chain-integrity-gate` مع السلاسل. **قرار المدير** |

**ملاحظة متوازنة:** يوجد `ListingService.validateAttributes.test.ts` ويذكر
`requiredSpecKeysFor` في تعليقه (`:8`) — **لكنه يختبر الخادم وحده.**

---

# ٥) ما لم أتمكن من إثباته — **بصراحة**

| البند | السبب |
|---|---|
| **هل `offer_type` مطلوب في الموبايل؟** | الترويسة الموثقة لا تذكره؛ `REQUIRED_SPEC_KEYS` لم أقرأ قيمه الفعلية. **غير قابل للإثبات بالأدلة التي جمعتها** |
| أي رحلة منفّذة فعليًا (تسجيل → نشر → ظهور) | Clerk يرفض أصل هذه البيئة · لا قاعدة بيانات محلية |
| سلوك الرفع الحقيقي (شبكة · GCS) | لم أشغّل رفعًا |
| رحلات الأقسام على الشاشة | **حكم بصري — غير ممكن من هنا** |

---

# ٦) الحصيلة

## ✅ مثبت سليم
| البند | الدليل |
|---|---|
| رحلة الحساب مكتملة | 6 دوال في `UserService` |
| قائمة أنواع الميديا allowlist مع استبعاد `svg+xml` | `uploadController.ts:36-43` |
| رفع بلا تحقق غير ممكن | `verifyUploadHandler` يرفض عند `size == null` |
| وسيط واحد إلزامي للنشر | مساران في `ListingService` |
| العميل أصرم من الخادم | اتجاه آمن |
| تصغير الصور قبل الرفع | 2048px · جودة 0.85 |

## 🔴 خطر مثبت
**مصدران للحد الإلزامي، والتزامن معتمد على تعليق** — ونفس الصنف سبق أن
أنتج باجًا مانعًا للنشر في هذا المستودع بالذات.

---

**لم أعدّل أي كود. لم أتخذ أي قرار معماري.**

— مهندس التحقق
