# خطة الدمج المصححة — بالأدلة

**من:** الوكيل المساعد · **التاريخ:** 2026-08-06 · **`main` = `d3f8df1`**

> **توصيتي السابقة كانت ناقصة. الأدلة تحت بتغيّرها.**

---

# ١) 🔴 الخطة اللي وصّيت بيها بتديك **نص الهيدرز بس**

قست تعديلات كل هيدر على كل فرع:

```bash
git diff --shortstat origin/main...origin/claude/<branch> -- '*/car/CarsHomeHeader.tsx'
```

| الفرع | Cars | Stays | Property | Materials |
|---|---|---|---|---|
| `headers-dynamic-polish` **(اللي وصّيت بيه)** | **+8** | **+0** | +240 | +159 |
| `testing-correction-pressure` | +0 | +0 | +0 | +0 |
| `are-you-here` | +0 | +0 | +0 | +0 |
| `integration-all` | +213 | +331 | +227 | +159 |
| **`project-understanding-manager-lcgi3u`** | **+238** | **+331** | +227 | +159 |

## النتيجة الصريحة

**«ادمج التلات فروع الجاهزة» بتديك العقارات والمواد بس.**
**هيدر السيارات (+238) وهيدر الحجز (+331) موجودين على الفروع المتعارضة
لوحدها.** **569 سطر شغل هيدرز هيتساب.**

---

# ٢) الفرع الشامل — `project-understanding-manager-lcgi3u`

## بيحتوي كل شغل B2 — متحقق كوميت كوميت

```bash
git merge-base --is-ancestor <sha> origin/claude/project-understanding-manager-lcgi3u
```

| الشغل | SHA | موجود؟ |
|---|---|---|
| خرايط — رفع الأدوات | `127e3d7` | ✅ |
| خرايط — رسم مساحة بحث | `a4c1eb0` | ✅ |
| خرايط — علامة القابل للحجز | `34709b4` | ✅ |
| `REPLACE_` مايوصلش لـwell-known | `5e9437e` | ✅ |
| حارس الاستيراد (`rgb()`) | `a1538f6` | ✅ |
| توحيد النيوترالز | `e495e02` | ✅ |

## واللي **مش** عليه — 4 كوميتات بس

```
714432c  Merge origin/main: take the render layer and CI build
a8e2ba5  test(mobile): guard the render layer, and cover the half of presence it missed
fe301a2  docs(channel)
df2ba82  docs(channel)
```

**يعني: الفريد عند `headers-dynamic-polish` هو حارس طبقة الرندر + دمج
`main` + مستندين. مش شغل منتج.**

---

# ٣) 🔴 وحقيقة تخصني — إصلاحي على `main` **ناقص**

## التعارض الوحيد الجوهري

```
<<<<<<< HEAD  (إصلاحي، على main دلوقتي)
  POWERED BY جوه poweredRow قبل العلامة
=======  (الفرع)
  POWERED BY فوق العلامة في عمود (poweredCol)
  «جنب بعض بياخدوا ~110dp من صف 358dp واسم القسم بيتقص لـPRO… — ضرر هوية.
   مكدّسين بياخدوا ~58dp»
>>>>>>>
```

## الفحص

```bash
grep -A8 "poweredRow:" .../PropertyHomeHeader.tsx
#   flexWrap: "wrap"      ← لسه موجود في نسختي
```

**نسختي شالت «POWERED BY في سطر لوحده» — وسابت `flexWrap: "wrap"`.**
**و«ragged wrap» عيب تاني من السبعة اللي المالك سمّاهم بنفسه.**

**نسخة الفرع بتحل الاتنين**، وعندها **قياس بالأرقام** (110dp مقابل 58dp على
358dp) — **وأنا مالوش قياس، كان عندي تشخيص بس.**

### ✅ الحكم: **إصلاحي متجاوَز. خُد نسخة الفرع.**

---

# ٤) الخطة المصححة

```bash
git fetch origin --prune
git checkout -B integration origin/main

# ① الفرع الشامل — الهيدرز الأربعة + الخرايط + REPLACE_ + الحُرّاس
git merge --no-edit origin/claude/project-understanding-manager-lcgi3u
```

**تعارضان بس** (متحقق منهم بتشغيل فعلي):
```
artifacts/banco-mobile/components/search/property/PropertyHomeHeader.tsx
artifacts/banco-mobile/package.json
```

**حلهما:**
```bash
# PropertyHomeHeader → نسخة الفرع (poweredCol، بقياس موثّق)
git checkout --theirs -- artifacts/banco-mobile/components/search/property/PropertyHomeHeader.tsx
git add artifacts/banco-mobile/components/search/property/PropertyHomeHeader.tsx

# package.json → اتحاد: خُد تبعيات jest من main + سكربتات الفرع
```

```bash
# ② الباج اللي المالك شافه — صفر تعارض
git merge --no-edit origin/claude/are-you-here-84u6fs

# ③ حارس الاستيراد الأشمل + الحارس على المستودع كله
git merge --no-edit origin/claude/testing-correction-pressure-7ycvwa

# ④ حارس طبقة الرندر (الفريد الوحيد عند B2)
git merge --no-edit origin/claude/headers-dynamic-polish
```

## ⚠️ وبعد الدمج — الخطوة اللي git مش شايفها

```bash
grep -c "export function sectionAccentAlpha" artifacts/banco-mobile/lib/sectionTheme.ts
# لو 2 → احذف اللي مش فيه Math.max/Math.min
```
**من غيرها: `TS2323` + `TS2393`.**

## التحقق الإجباري

```bash
pnpm install
pnpm run typecheck                          # من الجذر
pnpm --filter @workspace/banco-mobile run test
node scripts/chain-integrity-gate.mjs
# ثم CI بـworkflow_dispatch — مابيولّعش لوحده
```

---

# ٥) اللي اتغير في توصيتي — بصراحة

| السابق | المصحح | السبب |
|---|---|---|
| ابدأ بـ`are-you-here` | ابدأ بـ**`project-understanding-manager`** | هو الشامل — 569 سطر هيدرز زيادة |
| `headers-dynamic-polish` = أثمن فرع | **الفريد عنده 4 كوميتات، منها 2 مستندات** | القياس |
| إصلاحي على `main` صح | **متجاوَز** | سابت `flexWrap: "wrap"` = «ragged wrap» |
| 3 فروع جاهزة تكفي | **4 فروع، والشامل الأول** | الهيدرز مقسومة |

**سبب الغلط في توصيتي:** قست **قابلية الدمج** (تعارض/مفيش تعارض) وبنيت
عليها الترتيب، **من غير ما أقيس المحتوى**. الفرع النضيف مش معناه إنه الأهم.

---

# ٦) اللي لسه بيتساب حتى بالخطة المصححة

`integration-all` عنده **7 كوميتات فريدة** — لازم تتراجع قبل حذفه.
`project-understanding-manager` بياخد **21 من الـ44**، والباقي مشترك.

```bash
git log --oneline origin/claude/integration-all --not \
  origin/claude/project-understanding-manager-lcgi3u origin/main
```

---

**كل رقم فوق من تشغيل فعلي في فرع تجريبي محلي، مش من قراءة.**

— الوكيل المساعد
