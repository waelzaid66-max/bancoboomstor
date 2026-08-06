# خريطة الفروع الكاملة · وأوامر التنسيق

**من:** الوكيل المساعد (`session_011AM6FmwA4L1EfrkHmr7J28`)
**إلى:** المدير · **التاريخ:** 2026-08-06 · **`main` = `d3f8df1`**

> **أنا سبب جزء من التشتت ده.** الخريطة تحت مبنية على قياس، وكل أمر مكتوب
> جاهز للنسخ.

---

# ١) خريطة كل فرع — بلا استثناء

| الفرع | مقدّم | متأخر | كود | **كوميت فريد** | دمج | الحكم |
|---|---|---|---|---|---|---|
| `are-you-here-84u6fs` | 2 | 0 | 3 | — | ✅ | 🟢 **انزل فورًا** |
| `testing-correction-pressure-7ycvwa` | 6 | 0 | 15 | — | ✅ | 🟢 **انزل تاني** |
| `headers-dynamic-polish` | 17 | 0 | 29 | **4** | ✅ | 🟢 **انزل تالت** (بحل التعارض) |
| `integration-all` | 39 | 8 | 25 | **7** | 🔴 | 🟡 راجع الـ7 |
| `project-understanding-manager-lcgi3u` | 57 | 5 | 32 | **21** | 🔴 | 🟡 راجع الـ21 |
| `five-headers` | 23 | 13 | 8 | **0** | 🔴 | ⚫ **ميت — احذفه** |
| `boom-car-hero-header` | **0** | 72 | 0 | 0 | — | ⚫ **ميت — احذفه** |
| `local-audit-cars-header-defect` | 2 | 5 | 0 | — | — | ⚪ مستندات بس |
| `halo-i07jkh` | 1 | 0 | 0 | — | ✅ | ⚪ مستندات بس |
| `halo-e1biie` (بتاعي) | 6 | 0 | 0 | — | ✅ | ⚪ مستندات بس |

## علاقات الاحتواء — **مهمة**

```
five-headers  ⊂  integration-all
five-headers  ⊂  project-understanding-manager-lcgi3u
```

**`five-headers` صفر كوميت فريد** — كل محتواه موجود في فرعين تانيين.
**`boom-car-hero-header` مقدّم بصفر** — مدموج بالكامل.

**الاتنين دول ضوضاء خالصة. حذفهم بيقلل الخريطة من 10 لـ8.**

## اكتشاف مهم — الخرايط **مش مكررة**

نفس التلات كوميتات بنفس الـSHA على تلات فروع:
```bash
127e3d7 · a4c1eb0 · 34709b4
```
```bash
git merge-base --is-ancestor 127e3d7 origin/claude/integration-all   # ✅
```
**تاريخ مشترك، مش شغل متكرر.** أي فرع فيهم بينزل بياخد الخرايط معاه.

---

# ٢) أوامر التنسيق — انسخ ونفّذ

## المرحلة ١ — تنضيف (آمن تمامًا)

```bash
# فرعان مالهمش أي محتوى فريد
git push origin --delete claude/five-headers
git push origin --delete claude/boom-car-hero-header
```

## المرحلة ٢ — الدمج بالترتيب المختبَر

```bash
git fetch origin --prune
git checkout -B integration origin/main

# 1) صفر تعارض — وفيه الباج اللي المالك شافه
git merge --no-edit origin/claude/are-you-here-84u6fs

# 2) صفر تعارض
git merge --no-edit origin/claude/testing-correction-pressure-7ycvwa

# 3) 7 تعارضات — الحل تحت
git merge --no-edit origin/claude/headers-dynamic-polish
```

### حل التعارضات السبعة

```bash
# الاستيراد وحارسه → نسخة TCP (الأشمل: مسكت import-tracking.tsx بره المجلد)
for f in artifacts/banco-mobile/app/import/auctions.tsx \
         artifacts/banco-mobile/app/import/documents.tsx \
         artifacts/banco-mobile/app/import/index.tsx \
         "artifacts/banco-mobile/app/import/order/[id].tsx" \
         artifacts/banco-mobile/tests/import-honesty-guard.test.mjs; do
  git checkout --ours -- "$f" && git add "$f"
done

# اختبار PresenceLabel → نسخة are-you-here (10 اختبارات مقابل 3)
git checkout --ours -- artifacts/banco-mobile/tests/render/PresenceLabel.render.test.tsx
git add artifacts/banco-mobile/tests/render/PresenceLabel.render.test.tsx

# package.json → اتحاد يدوي. السلسلة النهائية 30 خطوة وتشمل:
#   assistant-identity · retired-red · map-chrome · geo-area
#   section-neutrals · render-coverage · render
```

### 🔴 وبعد الدمج — تعارض دلالي **git مش شايفه**

```bash
grep -n "export function sectionAccentAlpha" artifacts/banco-mobile/lib/sectionTheme.ts
# لو طلع سطرين → احذف اللي **مش** فيه Math.max/Math.min (نسخة TCP غير المحصورة)
```
**من غير الخطوة دي البناء بيقع بـ`TS2323` و`TS2393`.**

## المرحلة ٣ — التحقق (إجباري قبل التثبيت)

```bash
pnpm install
pnpm run typecheck                                    # من الجذر — مش --filter
pnpm --filter @workspace/banco-mobile run test
node scripts/chain-integrity-gate.mjs
```

**النتيجة اللي وصلتلها أنا:** typecheck نضيف · **28 ملف حارس بصفر فشل** ·
حارس واحد فاشل (`render-coverage` — §4).

## المرحلة ٤ — CI ثم التثبيت

```bash
# الـCI مابيولّعش لوحده على كوميتات الوكلاء — لا push ولا pull_request
gh workflow run ci.yml --ref integration     # أو من واجهة GitHub
# انتظر الأخضر، وبعدين افتح PR على main
```

---

# ٣) أهم المستندات — أيها حي وأيها بايت

## 🔴 مستندات **بتضلّل** — صحّحها أول حاجة

| المستند | المشكلة |
|---|---|
| `docs/DEPLOYMENT_SOURCE_OF_TRUTH.md` | بيقول `banco-with-wael` = «ONLY deploy SoT». **بايت — من 07-30، قبل الهجرة بيومين** |
| `README.md` | بيقول `-BANCO-CA-OOM-` أساسي. **بايت** |
| `DUAL_REPO_STATUS.md` | نفس الغلط |
| `PROJECT_STATUS.md` | ✅ **اتصحح** — مهمة #18 كانت مكتوبة «حرجة» وهي مقفولة |

**الصح: `waelzaid66-max/bancoboomstor` هو مصدر الحقيقة بعد الهجرة
(`89d28d3`, 08-01 04:23).**

## ✅ مستندات حية ودقيقة

| المستند | المحتوى |
|---|---|
| `TO-MANAGER-AGENT-INTEGRATION-AUDIT-AR.md` | ترتيب الدمج + 7 حلول تعارض **مختبَرة** |
| `TO-CODEX-SOURCE-OF-TRUTH-AFTER-MIGRATION-AR.md` | الخط الزمني + الأوسمة |
| `TO-CODEX-CORRECTIONS-AND-ICON-TYPE-GAP-AR.md` | تصحيح غلطتين + فجوة 200 اسم |
| `DAMAGE-REPORT-CLAUDE-AGENTS-AR.md` | الضرر بالأرقام |
| `UNDERSTOOD-BUT-NOT-DONE-AR.md` | فجوة النشر على AWS |
| `TO-MANAGER-FULL-BRIEF-AR.md` | الأيقونات وأندرويد + الأخطاء المتكررة |

## ⚪ الباقي — 132 ملف

**138 ملف · 2.9 ميجا · كلها وكلاء بيكتبوا لوكلاء.** ولا ملف توثيق منتج.
**متقراهاش كلها** — الستة فوق فيهم كل اللي محتاجه.

---

# ٤) اللي ناقص · متعارض · اتنفّذ غلط

## ناقص تمامًا
| البند | الحالة |
|---|---|
| **تواريخ الحجز في العقد** | **صفر سطر كود.** `grep -rn "check_in\|guests" lib/search-contract/src/` = 0 — واتكتب عنه في 3 مستندات |
| `Dockerfile.banco-website` لـ**aws** | مش موجود |
| أي واجهة على **gcp** | `Dockerfile.api` بس |
| **أوسمة** | صفر — `deploy.yml` بيولّع على `v*.*.*` ومستحيل يشتغل |

## 🔴 اتنفّذ غلط
| البند | التفصيل |
|---|---|
| **`deploy.yml` بينشر `banco-web`** | وده **مجمّد** (`FROZEN.md`: "do not extend"). المفروض `banco-website` |
| **`sectionAccentAlpha` مرتين** | git بيدمج نظيف والبناء يقع |
| **حارس `render-coverage`** | بيدوّر على `export function [A-Z]` و`icons.tsx` مافيهاش ولا واحدة — `Feather` متصدّرة بشكل تاني. **قرار صاحبه** |

## متعارض
| البند | الحل |
|---|---|
| 7 تعارضات `headers-dynamic-polish` | مكتوبة كأوامر في §2 |
| `integration-all` · `project-understanding-manager` | متعارضين على `PropertyHomeHeader.tsx` و`package.json` — **بسبب تعديلاتي أنا**. الأنضف إنهم يسحبوا `main` ويحلّوا مرة واحدة |

---

# ٥) توصياتي — بالترتيب وبالسبب

| # | التوصية | السبب |
|---|---|---|
| 1 | **انزل `are-you-here` النهاردة** | باج شافه المالك بعينه · صفر تعارض · صفر مبرر للتأخير |
| 2 | **احذف الفرعين الميتين** | 10 فروع → 8 · صفر مخاطرة |
| 3 | **نفّذ الدمج بأوامر §2** | يفكّ **429 سطر خرايط** + تقسيم الهيدرز |
| 4 | **صحّح الـ3 مستندات المضلّلة** | حاجز أمان ضد نشر ريبو غلط |
| 5 | **قرّر `deploy.yml`: مجمّد ولا حي؟** | **ده بيغيّر اللي بيتشحن للإنتاج** — قرار مالك مش وكيل |
| 6 | **افرض الحجز في القناة** | 5 ازدواجات سببها الوحيد ده |
| 7 | **فرع واحد لكل نطاق** | الخرايط النضيفة محبوسة بسبب ملفات استيراد على نفس الفرع |

---

# ٦) القواعد اللي تمنع تكرار اللي حصل

```
1. pnpm run typecheck  من الجذر — مش --filter    → منعت 47 ساعة كسر
2. اختبر الحالة المدموجة مش الفرع                 → sectionAccentAlpha
3. workflow_dispatch قبل أي تثبيت                → CI مابيولّعش لوحده
4. حجز في القناة قبل أول كوميت                    → 5 ازدواجات
5. فرع واحد لكل نطاق                              → الخرايط المحبوسة
6. ممنوع الزقّ المباشر على main                   → كل شغل من PR
7. «اتعمل» ≠ «نزل» — النهاية هي main              → 3 بنود منفّذة ومحبوسة
```

---

**تحت أمرك.** كل أمر فوق منسوخ من تنفيذ حقيقي عملته في فرع تجريبي، مش
مقترح نظري.

— الوكيل المساعد
