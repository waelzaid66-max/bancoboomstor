# أوديت جودة عميق مستقل — إلى المدير Codex ووكلاء Claude

**من:** وكيل الجودة / منع التلوّث (Claude) · **التاريخ:** 2026-08-08
**الريبو:** `waelzaid66-max/bancoboomstor` · **main = `36766cf`** (v4.1.4)
**الطريقة:** تحقّق مستقل بالأدلة على HEAD الحالي — كل سطر تحته أمر قابل لإعادة الإنتاج. لا نقل من ذاكرة، ولا حكم بصري (Clerk بيرفض الأصل — القياس هندسي فقط).

> هدف التقرير: أعمق من الأوديتات السابقة + تدقيق شغل الوكلاء أنفسهم + رصد المتبقّي والمتركّب في مكان غلط.

---

## ٠) الحكم التنفيذي

| المحور | الحالة | الملكية |
|--------|--------|---------|
| المصدر القانوني | ✅ `bancoboomstor` (هجرة `89d28d3`, 2026-08-01) — مؤكّد | — |
| **بناء الموبايل** | 🔴 **كان مكسورًا** (`sectionAccentAlpha` مكررة) — **أصلحته** | Claude ✅ |
| test:icons | 🔴 كان فاشلًا (4 أيقونات) — **أصلحته** | Claude ✅ |
| مسار نشر الإنتاج | 🔴 **معطّل فعليًا** (صفر أوسمة) | **المالك** |
| مستند «مصدر الحقيقة» | 🔴 **بايت وسامّ** (بيوجّه لريبو غلط) | المدير/المالك |
| شغل إنتاج متروك | 🟠 تحصين well-known + بوابات في فرع مش نازل | المدير |
| توحيد الموبايل | ✅ مكتمل (صفر ملف ناقص مقابل bancotoday) | — |

---

## ١) 🔴 بناء الموبايل كان مكسورًا — عيب فات تقرير v4.1.4 (أصلحته)

`artifacts/banco-mobile/lib/sectionTheme.ts` فيه **تعريفين module-level كاملين** لنفس الدالة:
```bash
grep -nE "^export function sectionAccentAlpha\(" artifacts/banco-mobile/lib/sectionTheme.ts
# قبل الإصلاح: سطر 41 + سطر 180  → اتنين
```
اتنين `export function` بنفس الاسم في نفس الموديول = **TS2323 (cannot redeclare) + TS2393 (duplicate implementation)** → `tsc` بيقع، والموبايل مبيعدّيش typecheck.

**ليه فات على الكل:** نزل عبر **دمج نظيف** (نفس التوقيع، **بلا conflict markers**) — فعدّى من تنظيف الـ markers (`7a47b94`) ومن تقرير v4.1.4. الوكيل في `TO-CODEX-SOURCE-OF-TRUTH` تنبّأ بيه يوم 08-06 وقت ما main كانت صفر؛ بين 08-06 و HEAD القنبلة اشتغلت.

**الإصلاح:** شلت النسخة القديمة غير المحصّنة، أبقيت المحصّنة (clamped، نفس التوقيع → 7 مستدعيين مش متأثرين). → فرع `claude/qa-audit-fixes` (`c58a790`).

---

## ٢) 🔴 test:icons — 4 أيقونات غير مسجّلة (أصلحته)

الأربعة مستخدمة في `app/business/banks.tsx` وغير موجودة في `components/icons.tsx`:
`alert-circle-outline` · `file-document-outline` · `information-outline` · `upload`.
مكوّنات lucide الأربعة (`CircleAlert/FileText/Info/CloudUpload`) متسطّرة أصلاً → إضافة بحتة. → `90022c2`.

بالإضافة: `metro.config.js` blockList لمسارات Replit المؤقتة (مشكلة #8). نفس الكوميت.

---

## ٣) 🔴 مسار نشر الإنتاج معطّل — قرار المالك

```bash
git tag -l | wc -l                # 0
node -e "console.log(require('./package.json').version)"   # 0.0.0
```
`.github/workflows/deploy.yml` بيولّع على `push: tags: ["v*.*.*"]`. **مفيش ولا وسم** → النشر التلقائي **مستحيل يشتغل**. الوسم الوحيد المعروف (`v1.0.0-rc.1`) عايش في الريبوهات القديمة، الهجرة نقلت الكود ومنقلتش السلسلة الإصدارية.
**الخيار:** (أ) وسم `v1.0.0` يستأنف السلسلة ويفعّل النشر — **قرار مالك مكتوب فقط، الوسم بيولّع إنتاج**، أو (ب) الاكتفاء بـ`workflow_dispatch` يدوي بلا هوية إصدار.

---

## ٤) 🔴 مستند «مصدر الحقيقة» سامّ — لسه على main

```bash
git show origin/main:docs/DEPLOYMENT_SOURCE_OF_TRUTH.md | grep -i "ONLY deploy"
# | ONLY deploy SoT repository | .../waelzaid66-max/banco-with-wael |
```
المستند اللي اسمه حرفيًا «Source of Truth» **بيوجّه لريبو `banco-with-wael`** (قبل الهجرة). أي وكيل جديد يقراه → **ينشر الريبو الغلط**. نفس الشيء `README.md` + `DUAL_REPO_STATUS.md`.
**توصية:** أول تصحيح لازم يوحّد التلاتة على `bancoboomstor` — ده حاجز أمان مش تنظيف.

---

## ٥) 🟠 شغل إنتاج متروك برّه القانوني (اتركّب في مكان غلط)

فحص كل الفروع: الشغل غير المندمج مقابل main:
```bash
for b in $(git branch -r|grep -v main); do echo "$b $(git rev-list --count origin/main..$b)"; done
```
| الفرع | متروك | المحتوى |
|-------|:---:|---------|
| **`claude/headers-dynamic-polish`** | 4 كوميت / 42 ملف | 🟠 **كود إنتاج:** `deploy/coolify/well-known/render-well-known.mjs` (يرندر AASA/assetlinks من build-args ويتحقق منها — يمنع شحن `REPLACE_` صامت يكسر universal links) + `scripts/chain-integrity-gate.mjs` + تحديث `production-confidence-check.mjs` + اختبار render-layer + صور إثبات |
| `claude/halo-e1biie` | 12 | 📋 تقارير جنائية (DAMAGE-REPORT, VERIFICATION-LEDGER, CORRECTED-MERGE-PLAN, SOURCE-OF-TRUTH) |
| `claude/halo-i07jkh` | 1 | 📋 SPEC-CARS-HERO |
| `claude/local-audit-cars-header-defect` | 2 | 📋 MEMORY-DUMP للـ Codex |

**الأهم:** `headers-dynamic-polish` فيه تحصين نشر حقيقي **مش نازل**. توصية: يُدمج بعد مراجعة (الوكيل السابق وثّق ترتيب الدمج وحلول التعارض في `TO-MANAGER-AGENT-INTEGRATION-AUDIT-AR.md`).

---

## ٦) تدقيق ادعاءات الوكلاء السابقين (تصحيح للسجل)

| ادعاء سابق (08-06) | الحقيقة على HEAD (08-08) |
|---|---|
| باج أيقونة «send» حي (`FILLED` من غير send) | ✅ **اتحل واندمج** — `FILLED = new Set(["heart","star","send"])`. الادعاء بقى قديم |
| conflict markers في import/auctions+documents | ✅ **اتنضّفت** (`7a47b94`) — صفر متبقّي repo-wide |
| `sectionAccentAlpha` «هتكسر عند الدمج» | 🔴 **حصلت فعلًا** — نزلت على main. أصلحتها (بند ١) |

---

## ٧) توحيد وأمان — ✅

- **superset:** `diff bancotoday↔bancoboomstor/banco-mobile` → **صفر ملف ناقص** من القانوني. توحيد الموبايل مكتمل.
- **أسرار:** فحص repo-wide → صفر مفاتيح حية؛ كل `pk_live_` تعليقات/أمثلة. لا `.env` مرفوع.

---

## ٨) خطة مقترحة بالأولوية

**دمج (مراجعة المدير):**
1. `claude/qa-audit-fixes` (3 إصلاحات: بناء + أيقونات + metro) — **يفكّ typecheck + سلسلة الاختبارات**.
2. `claude/headers-dynamic-polish` — تحصين well-known + بوابات.

**تنظيف حواجز أمان:**
3. توحيد `DEPLOYMENT_SOURCE_OF_TRUTH.md` + README + DUAL_REPO_STATUS على `bancoboomstor`.
4. pre-commit hook ضد conflict markers (وقاية مشكلة #6).

**قرار المالك:**
5. وسم `v1.0.0` (يفعّل النشر) — أمر مكتوب فقط.
6. مفاتيح Clerk من نفس الـ instance (#3) · DB خارجية لـ CI (#7).

---

*تحقّق ساكن على read/clone. ما لم يُشغَّل: `tsc`/tests فعليًا (تحتاج deps + بيئة Replit) — لكن عيب البناء (بند ١) مثبت بقواعد اللغة لا بالتشغيل.*
