# مواصفة — هيدر السيارات: حاوية واحدة

**التاريخ:** 2026-08-04 · **المصدر:** تصحيح معماري من المالك
**كتبها:** الأوديتور · **الحالة:** جاهزة للتنفيذ · **الأساس:** `claude/five-headers` بعد الـrebase

---

## 0) ده مش طلب تصميم

المالك كتبها بنفسه بالنص:

> This is NOT a new design request. This is NOT a redesign. This is NOT a layout
> suggestion. **This is a correction to a repeated architectural mistake.**
>
> **You have failed to understand this requirement after more than 18 iterations.**

وحدّد الممنوع صراحة:

> Do NOT create a separate filters section.
> Do NOT move filters below the hero.
> Do NOT create stacked content blocks.

وحدّد المطلوب:

> The search bar, vehicle categories, filter chips, country selector, condition
> chips, brand selector, financing chips, and every filtering control **MUST ALL
> live INSIDE the hero container.**
>
> Only change the architecture so that every search and filtering element becomes
> part of the hero itself. **Preserve all existing functionality. Only change
> where those components live.**

وحدّد معيار الفشل:

> If your output still contains a separate filters section under the hero, then
> you have failed to follow the instructions.

---

## 1) ليه فشلت 18 مرة — السبب في سطر واحد

كل المحاولات ساوت **الاتصال البصري** بـ**الاحتواء المعماري**. والاتنين مش نفس الحاجة.

**الدليل، من `claude/five-headers` @ `32954ef`:**

```
CarsHomeHeader.tsx:237   marketSlot?: React.ReactNode;      ← الوصلة اتعرّفت
CarsHomeHeader.tsx:684   {marketSlot ? (<View …>{marketSlot}</View>) : null}   ← وبترندر

SectionSearchApp.tsx     grep -n 'marketSlot' → صفر نتائج    ← ومحدش مرّرها
```

**الوصلة اتبنت وماتوصلتش.** الفلاتر فضلت **إخوة (siblings)** لـ`<CarsHomeHeader>`
في شجرة الـJSX، واتعمل بدل التوصيل:

```js
carFilterPanel:       { backgroundColor: "#090909", paddingTop: 10 }
carFilterPanelFooter: { backgroundColor: "#090909", borderBottomLeftRadius: 20, … }
```

يعني: **دهان بنفس لون الهيدر عشان القسم المنفصل يبان ملتصق.** ده بالظبط اللي
المالك بيرفضه. وقبلها كانت محاولة تانية (`carFiltersOpen` على `main`): زرار بيطوي
الفلاتر — **إخفاء**، لا احتواء.

| المحاولة | اللي اتعمل | ليه فشل |
|---|---|---|
| `main` الحالي | زرار «الفلاتر» بيطوي القسم | إخفاء مش احتواء · القسم لسه منفصل |
| `five-headers` | نفس خلفية الهيدر + زوايا سفلية | **دهان** · الشجرة لسه إخوة |
| المطلوب | الفلاتر **جوه** حاوية الهيرو | — |

---

## 2) الشجرة المطلوبة

```
CarsHomeHeader  (Animated.View style={styles.root})   ← الحاوية الوحيدة
 ├── صورة الخلفية (shellPlate)          ✅ موجودة
 ├── طبقة التعتيم (scrim)                ✅ موجودة
 ├── الشريط العلوي (topBar)              ✅ موجودة
 ├── الهيرو + الوهج (hero)               ✅ موجودة
 ├── شريط البحث (searchRow)              ✅ موجودة
 ├── أنواع المركبات (catScroll)          ✅ موجودة
 ├── ▸ مُنتقى الدولة + العملة            ❌ تحت دلوقتي — يتنقل
 ├── ▸ شرائح الحالة (listingMode)        ❌ تحت دلوقتي — يتنقل
 ├── ▸ شرائح المحركات (engines)          ❌ تحت دلوقتي — يتنقل
 ├── ▸ الترتيب (sort)                    ❌ تحت دلوقتي — يتنقل
 ├── ▸ مُنتقى الماركة + المنشأ           ❌ تحت دلوقتي — يتنقل
 ├── الإحصاءات (statScroll)              ✅ موجودة
 └── الحافة السفلية للهيرو
────────────────────────────────────────
القسم التالي يبدأ هنا:  نتائج البحث / المعروضات
```

**مفيش أي عنصر فلترة بين `</CarsHomeHeader>` وقائمة النتائج.**

---

## 3) آلية التنفيذ — نقل، مش إعادة كتابة

المالك: «Preserve all existing functionality. **Only change where those
components live.**» — فالتنفيذ **قص ولزق**، مش صياغة جديدة.

### ٣-١ في `CarsHomeHeader.tsx`

الوصلة الموجودة (`marketSlot`) **تتوسّع** لتحمل كتلة الفلاتر كاملة. الهيدر يفضل
**بلا حالة (stateless)** زي ما هو — بياخد عقدة جاهزة ويرندرها.

```tsx
/**
 * كتلة الفلاتر كاملة — مملوكة ومرندرة من الأب.
 *
 * بتوصل كـnode مش كـdata، عشان الهيدر ميعرفش حاجة عن الأسواق ولا الماركات
 * ولا المحركات ولا حالته. الحالة كلها فاضلة في SectionSearchApp — ده اللي
 * بيخلي النقل ده «مكان» مش «إعادة كتابة».
 */
filtersSlot?: React.ReactNode;
```

وترندر **جوه `styles.root`**، بعد شريط الأنواع وقبل الإحصاءات:

```tsx
{showPinned && filtersSlot ? (
  <View style={styles.filtersSlot} testID="cars-header-filters">
    {filtersSlot}
  </View>
) : null}
```

**قيد:** لازم تبقى داخل `<Animated.View style={styles.root}>` نفسها اللي شايلة
`shellPlate` — عشان الفلاتر تعوم فوق نفس الصورة. لو اترندرت بره الحاوية دي،
التنفيذ فشل مهما بان الشكل.

### ٣-٢ في `SectionSearchApp.tsx`

الـJSX الموجود **يتلمّ في متغيّر** وينتقل — نفس المحتوى بالحرف:

```tsx
const carFiltersSlot = isCarSection ? (
  <>
    {/* section-primary-strip كما هو: MarketCountryButton · sort · listingMode · engines */}
    {/* car-brand-origin-strip كما هو: car-brand-strip · car-origin-strip */}
  </>
) : null;
```

ويتمرّر: `<CarsHomeHeader … filtersSlot={carFiltersSlot} />`

وشروط الشرائط تحت **يتشال منها فرع السيارات** — مش يتحذف الشريط (باقي الأقسام
لسه بتستخدمه)، **يتشال فرع السيارات بس**.

### ٣-٣ اللي يتحذف

| البند | السبب |
|---|---|
| `styles.carFilterPanel` | دهان المعمارية القديمة — وجوده دليل إنها لسه قايمة |
| `styles.carFilterPanelFooter` | نفس السبب |
| `carScrollHeader` (ميمو ≈70 سطر) | **كود ميت** — مبني ومش مستخدم بعد إعادة كتابة `listHeader` |
| `carFilterToggle*` (4 ستايلات) | ميتة بعد شيل زرار الفلاتر |

---

## 4) معايير القبول — قابلة للفحص آليًا

**السبب في وجودها:** 18 محاولة قالت «اتعمل» وماتعملش. الادعاء لوحده مابقاش دليل.
الحارس المقترح: `artifacts/banco-mobile/tests/cars-one-container-guard.test.mjs`
(**ويترصّ في السلسلة** — «حارس مكتوب ومش متربط بالسلسلة يبقى مش حارس»).

| # | المعيار | الفحص |
|---|---|---|
| **ق١** | الوصلة **متوصّلة** مش معرّفة بس | `SectionSearchApp.tsx` فيه `filtersSlot={` — **ده المعيار اللي فشل 18 مرة** |
| **ق٢** | الفلاتر جوه حاوية الهيدر | `CarsHomeHeader.tsx`: `filtersSlot` بترندر جوه `styles.root` وتحت `showPinned` |
| **ق٣** | مفيش قسم فلاتر تحت الهيرو | فرع `isCarSection` **غايب** من شروط الشرائط اللي بعد الهيدر |
| **ق٤** | الدهان اتشال | `carFilterPanel` و`carFilterPanelFooter` **مش موجودين** |
| **ق٥** | صفر فقدان وظيفة | كل الـtestIDs دي لسه موجودة: `section-primary-strip` · `section-sort-cycle` · `section-listing-mode` · `section-engine` · `car-brand-origin-strip` · `car-brand-strip` · `car-brand-btn` · `car-origin-strip` |
| **ق٦** | الهيدر فضل بلا حالة | مفيش `useState` اتضاف لـ`CarsHomeHeader.tsx` |
| **ق٧** | الكود الميت اتشال | `carScrollHeader` و`carFilterToggle*` مش موجودين |
| **ق٨** | الحرّاس القايمة لسه خضرا | `car-hero-honesty` · `section-miniapp` · `section-neutrals` |

**ق٥ هو الأهم بعد ق١:** المالك قال «Preserve all existing functionality» —
أي `testID` يختفي معناها إن كنترول ضاع في النقل، وده رفض فوري.

---

## 5) البوابات قبل التسليم

```bash
pnpm run typecheck                                   # من الجذر — مش --filter
pnpm --filter @workspace/banco-mobile run test
node scripts/chain-integrity-gate.mjs
```

ثم، بقاعدة المالك الحاكمة:

```
اسحب main → ادمجه في فرعك → CI على الحالة المدموجة → أخضر → يتثبّت
```

---

## 6) اللي المواصفة دي **مش** بتصرّح بيه

- ❌ إعادة ترتيب البنود جوه الهيرو — الترتيب في §2 هو ترتيب المالك
- ❌ تبسيط أو دمج أي كنترول
- ❌ تغيير أي `testID` أو مفتاح i18n أو معالِج
- ❌ لمس `useSearchMiniApp` أو منطق البحث
- ❌ لمس `package.json` بتاع الموبايل أو الـlockfile (محجوز للمالك لحد ما بنية اختبار الرندر تنزل)

> **قاعدة الحسم:** لو الناتج لسه فيه قسم فلاتر منفصل تحت الهيرو — التنفيذ **فشل**،
> مهما كان شكله على الشاشة. الحكم لـق١–ق٤، مش للقطة شاشة.

---

## 7) ⚠️ حالة القفل

`SectionSearchApp.tsx` عليه **قفل حصري للوكيل A1** في أوامر العمل، وأوامر العمل
بتمنع «إعادة الهيكلة» فيه — **والتصحيح ده إعادة هيكلة بالتعريف**، بس في **مسار
السيارات**، مش في مسار A1 (العقارات/المواد).

**التنفيذ موقوف لحد أمر مكتوب من المالك/المدير.** المواصفة دي جاهزة تتسلّم لأي
منفّذ يتكلّف — والتنفيذ بعدها ميكانيكي.

— الأوديتور
