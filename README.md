# XYZ Pharmacy — Mwongozo wa Kuanzisha (Kiswahili)

Mfumo huu una sehemu 2:
- `index.html` — App ya wanachama (elimu ya afya, duka, kikapu, WhatsApp checkout, family chat)
- `admin.html` — Dashboard yako ya kusimamia (posts, bidhaa, oda, wateja)

Backend inayotumika ni **Firebase** (bure) kwa data ya moja kwa moja (live) na **Cloudinary** (bure) kwa kuhifadhi picha. Hosting ya tovuti ni **GitHub Pages** (bure).

---

## HATUA 1 — Tengeneza mradi wa Firebase

1. Fungua https://console.firebase.google.com na akaunti yako ya Google
2. Bonyeza **Add project**, ipe jina mf. `xyz-pharmacy`, endelea (unaweza zima Google Analytics)
3. Ukishatengeneza mradi, bonyeza icon ya **`</>`** (Web app) kuongeza app mpya ya web
4. Ipe jina mf. `xyz-pharmacy-web`, usijaze Firebase Hosting (hatuitaji, tunatumia GitHub Pages)
5. Firebase itakupa object ya `firebaseConfig` — **nakili maneno hayo yote**, utayahitaji Hatua ya 4

## HATUA 2 — Washa Authentication

1. Kwenye Firebase Console, nenda **Build > Authentication > Get started**
2. Kwenye tab **Sign-in method**, washa:
   - **Anonymous** (hii inatumika kutambua kila mgeni wa app bila usumbufu)
   - **Email/Password** (hii ni ya wewe Admin pekee kuingia admin.html)
3. Bado kwenye Authentication, nenda tab **Users > Add user**, weka email na password utakayotumia wewe kuingia admin panel (mf. `admin@xyzpharmacy.com`)
4. Baada ya kuunda, **nakili UID** ya huyo mtumiaji (inaonekana kwenye orodha ya users)

## HATUA 3 — Tengeneza Firestore Database

1. Nenda **Build > Firestore Database > Create database**
2. Chagua **Start in production mode**, chagua eneo (region) lolote karibu (mf. `eur3` au `nam5`)
3. Ukishaunda database, nenda tab **Rules**, futa yaliyopo, **bandika (paste) maudhui yote ya faili `firestore.rules`** iliyopo kwenye mradi huu, kisha **Publish**
4. Nenda tab **Data**, tengeneza collection mpya kwa mkono iitwayo `admins`
   - Weka **Document ID = UID** uliyoinakili Hatua 2.4
   - Ongeza field yoyote ndani yake, mf. `role: "admin"` (thamani yoyote, muhimu ni Document ID iwe sawa na UID)
   - Hii ndiyo inayompa admin ruhusa ya kuandika posts/bidhaa na kusoma orodha ya wateja

## HATUA 4 — Weka funguo za Firebase kwenye code

1. Fungua faili `js/firebase-config.js`
2. Badilisha `firebaseConfig` na thamani ulizonakili Hatua ya 1.5
3. Hakikisha `WHATSAPP_NUMBER` ni sahihi (tayari imewekwa `255742417963`)

## HATUA 5 — Tengeneza akaunti ya Cloudinary (kwa picha)

1. Fungua https://cloudinary.com/users/register/free na jisajili bure
2. Kwenye Dashboard, nakili **Cloud name** yako
3. Nenda **Settings (gear icon) > Upload > Upload presets > Add upload preset**
4. Weka **Signing Mode = Unsigned**, ipe jina fupi (mf. `xyz_pharmacy`), **Save**
5. Fungua tena `js/firebase-config.js`, jaza `CLOUDINARY_CLOUD_NAME` na `CLOUDINARY_UPLOAD_PRESET`

## HATUA 6 — Panda (Deploy) kwenye GitHub Pages

1. Tengeneza repo mpya GitHub, mf. `xyz-pharmacy` (public)
2. Pandisha (upload) faili/folda zote za mradi huu kwenye repo hiyo (unaweza kutumia GitHub Desktop au wavuti ya GitHub "Upload files")
3. Kwenye repo, nenda **Settings > Pages**
4. Chini ya **Build and deployment > Source**, chagua **Deploy from a branch**
5. Chagua branch `main` na folder `/ (root)`, bonyeza **Save**
6. Baada ya dakika 1-2, link yako itakuwa: `https://JINA-LAKO.github.io/xyz-pharmacy/`
7. Admin panel yako itakuwa: `https://JINA-LAKO.github.io/xyz-pharmacy/admin.html`

**Tuma link ya kwanza (bila `admin.html`) kwa wateja wako.** Link ya admin usiisambaze — ni ya wewe pekee (ina password ya kuingia).

## HATUA 7 — Kuweka App Simu (Add to Home Screen)

Mtu akifungua link yako kwa Chrome (Android) au Safari (iPhone):
- **Android/Chrome:** kutaonekana ujumbe "Install app" chini, au menu (⋮) > "Install app" / "Add to Home screen"
- **iPhone/Safari:** bonyeza icon ya Share (☐↑) > "Add to Home Screen"

Baada ya hapo, itaonekana kama app ya kawaida kwenye simu yao, na logo ya XYZ Pharmacy.

---

## Jinsi mfumo unavyofanya kazi

- **Wanachama** wanapofungua link, wanajaza jina + namba ya WhatsApp mara moja tu (inahifadhiwa kwenye simu yao)
- Wanaona **Makala za Elimu ya Afya**, **Duka** la bidhaa, wanaweza kuongeza kwenye **Kikapu**
- Wakibonyeza **"Tuma Oda kwa WhatsApp"**, WhatsApp inafunguka na ujumbe wa oda ukiwa tayari umeandikwa (bidhaa, kiasi, jumla, jina na namba yao) — wanabonyeza Send tu, oda inakuja moja kwa moja kwenye namba yako `+255742417963`
- Oda pia inahifadhiwa kwenye mfumo (**tab ya "Oda"** kwenye admin) ili uwe na kumbukumbu, hata kama mteja hajatuma WhatsApp
- **Family Chat** ni chat moja ya pamoja — kila aliyesajiliwa anaona ujumbe wa kila mtu, "live" (bila ku-refresh)
- Wewe kama **Admin** (`admin.html`):
  - Unachapisha makala ya elimu (na picha)
  - Unaongeza bidhaa moja moja, AU unapakia Excel (columns: `name, price, category, stock, imageUrl`) kwa mara moja kuongeza bidhaa nyingi
  - Unaona orodha ya oda zote na kubadilisha hali (Mpya / Imekamilika)
  - Unaona wote waliojisajili na unaweza **Export Excel** ya majina na namba zao

---

## Muhimu kuhusu kuuza dawa

Kuuza baadhi ya dawa mtandaoni kunahitaji kufuata kanuni za mamlaka husika (kwa Tanzania: TMDA). Hakikisha bidhaa unazouza kwenye "Duka" ni zile zinazoruhusiwa kuuzwa bila agizo la daktari (OTC), au una vibali stahiki kwa dawa nyingine. Hili ni jukumu lako kama mmiliki wa biashara — mfumo huu ni chombo tu cha kiteknolojia.

---

## Ukihitaji kubadilisha rangi/muonekano

Rangi kuu ziko kwenye `css/style.css` chini ya `:root` (`--green-700` ni rangi kuu, `--amber-600` ni rangi ya pili). Logo/icons ziko kwenye folder `icons/` — unaweza kuzibadilisha na logo lako halisi (ukubwa 192x192 na 512x512 px, PNG).
