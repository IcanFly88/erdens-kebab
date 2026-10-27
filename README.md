# Erdens Kebab – ételrendelő rendszer

Foodora-stílusú rendelőrendszer az Erdens Kebab monori üzletének (Monor, Kiss Ernő u. 1.).
A rendszer több üzletet is tud kezelni: új üzlethez elég egy újabb elem a `src/data/locations.ts`-ben.


- **Mobil app** (iOS + Android, Expo SDK 58 / React Native) – a vendégeknek
- **Backend** (`server/`, Node.js + SQLite, külső függőség nélkül) – rendelések fogadása, árak ellenőrzése
- **Éttermi panel** (`server/panel/`, böngészőben/tableten fut) – bejövő rendelések kezelése
- **Push értesítések** – a vendég értesítést kap minden státuszváltásról

## Demó (jelenlegi állapot)

| | Cím |
| --- | --- |
| Szerver / API | https://erdens-kebab-demo.onrender.com |
| Éttermi panel | https://erdens-kebab-demo.onrender.com/panel/ |

- **Tárhely:** Render ingyenes csomag, Frankfurt (`render.yaml`, `Dockerfile`). A GitHub `main` ágra
  történő minden push automatikusan újratelepíti. Ha egy commit nem érinti a szervert, írd az
  üzenetébe: `[skip render]`.
- **Korlátok:** 15 perc forgalom nélkül a szerver elalszik, az ébredés kb. 1 perc; újraindításkor és
  újratelepítéskor a rendelések törlődnek. Az app induláskor felkelti a szervert, rendelésnél kivárja
  az ébredést, a nyitva hagyott panel pedig ébren tartja.
- **Panel PIN:** Render → `erdens-kebab-demo` → Environment (`PANEL_PIN_MONOR`).

### A demó menete

1. Pár perccel előtte nyisd meg a panelt laptopon vagy tableten, lépj be, és koppints a „Hang” gombra.
2. A cég képviselője a TestFlightos appból rendel → a panel csenget → elfogadod egy elkészülési
   idővel → a telefonon megjelenik az állapot és az értesítés → léptetsz a kiszállításig.

### iOS app – TestFlight

**Állapot:** az App Store Connectben `Erdens Kebab` (azonosító `6827152968`, bundle `hu.erdenskebab.app`),
a TestFlight belső csoportjában (*Internal*) telepíthető. A push értesítések működnek (APNs kulcs
`WJW6L88657` az expo.dev-en, a projekt iOS credentials alatt).

Hitelesítés **Apple-jelszó nélkül**, App Store Connect API-kulccsal (`AuthKey_QV87XFFPUQ.p8` a
Letöltések mappában – ne töröld). Új verzió kiadása:

```bash
export EXPO_ASC_API_KEY_PATH="$HOME/Downloads/AuthKey_QV87XFFPUQ.p8" EXPO_ASC_KEY_ID=QV87XFFPUQ \
  EXPO_ASC_ISSUER_ID=7e0fbbf3-8f76-4633-9b10-ba17223145cd EXPO_APPLE_TEAM_ID=8GZ6FU7RBK \
  EXPO_APPLE_TEAM_TYPE=INDIVIDUAL EXPO_NO_CAPABILITY_SYNC=1 EXPO_NO_KEYCHAIN=1
npx eas-cli@latest build -p ios --profile production     # felhős build, a buildszám magától nő
npx eas-cli@latest submit -p ios --latest --profile production --non-interactive
```

Ha a build a push beállítására kérdez rá, válaszd a **No**-t (a kulcs már az Expón van). Az Apple a
feltöltés után 5–10 perc alatt dolgozza fel, utána a belső tesztelők automatikusan megkapják.

- **Belső tesztelők** (App Store Connect csapattagok): Apple ellenőrzés nélkül, azonnal kapják.
- **Külső tesztelők** (pl. a cég munkatársa e-mailben vagy nyilvános linkkel): külső csoport kell, és
  az első buildet az Apple béta-ellenőrzésen nézi át (általában kb. 1 nap). Mivel az app egy valódi
  étterem nevét viseli, a megjegyzésben érdemes jelezni, hogy a megbízásukra készül.

Androidra (opcionális) telepíthető APK: `npx eas-cli@latest build -p android --profile preview`.

## Gyors indítás (fejlesztés)

Két terminálban:

```bash
npm install
npm run server      # backend + éttermi panel: http://localhost:4000/panel/
```

```bash
npx expo start      # mobil app: i = iOS szimulátor, a = Android emulátor, vagy QR-kód Expo Go-val
```

Az app fejlesztéskor automatikusan a Metro-t futtató gép 4000-es portján keresi a backendet,
így telefonról is működik, ha a gép és a telefon ugyanazon a Wi-Fi hálózaton van.

**Éttermi panel belépés:** étterem kiválasztása + PIN. Fejlesztéskor az alapértelmezett PIN `1234`
(élesben kötelező lecserélni, lásd lent).

## Hogyan működik egy rendelés

1. A vendég leadja a rendelést az appban → a szerver a **saját étlapja alapján újraszámolja az árakat**
   (a telefonról jövő árakban nem bízik), ellenőrzi a kötelező opciókat, a nyitvatartást, a
   szállítási zónát és a minimális rendelési értéket, majd napi sorszámot ad (pl. `M-012`).
2. A panelen azonnal megjelenik (Server-Sent Events), **ismétlődő csengővel**, amíg valaki el nem fogadja.
3. A személyzet elfogad egy elkészülési idővel (15/25/35/45/60 perc), vagy indoklással elutasít.
4. Léptetés: **Készül → Futárnak átadva / Átvehető → Kiszállítva / Átvéve**.
5. Az app minden lépést mutat időbélyeggel, és értesítést küld.
6. A panelről a **rendelésfogadás szüneteltethető** (pl. csúcsidőben) – ilyenkor az app jelzi, és nem enged rendelni.

## Push értesítések

| Környezet | Mi működik |
| --- | --- |
| Expo Go, iOS | helyi értesítések, amíg az app fut |
| Expo Go, Android | nincs értesítés (az Expo Go korlátja), a státusz az appban frissül |
| Fejlesztői / éles build | **valódi push** a szerverről, akkor is, ha az app be van zárva |

Valódi push bekapcsolása (egyszeri beállítás, Expo/Apple/Google fiók kell hozzá):

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # beírja az EAS projectId-t az app.json-ba
npx eas-cli@latest build --profile development --platform all
```

- iOS: Apple Developer fiók (az EAS build automatikusan létrehozza a push kulcsot).
- Android: Firebase projekt, `google-services.json` – lásd https://docs.expo.dev/push-notifications/fcm-credentials/
- Ajánlott: Expo access token a szerveren (`EXPO_ACCESS_TOKEN`), ha bekapcsolod az Expo push biztonságot.

Ezután az app automatikusan regisztrálja a push tokent a rendelés követésekor, és a szerver
(`server/src/push.ts`) minden státuszváltáskor küld értesítést.

## Élesítés

### Szerver

A `Dockerfile` bármilyen Docker tárhelyen fut (Render, Railway, Fly.io, VPS). Élesben fizetős csomag
kell **tartós tárhellyel** (Renderen: disk a `/data` útvonalra), különben újraindításkor elvesznek a
rendelések. Felhőben állítsd be: `NODE_ENV=production`, `TRUST_PROXY=1` (proxy mögött a valódi IP-hez).

| Környezeti változó | Leírás |
| --- | --- |
| `PORT` | alapértelmezés: 4000 |
| `DB_PATH` | az adatbázis fájl helye (alapértelmezés: `server/data/erdens.db`) |
| `PANEL_PIN_MONOR` | **kötelező** – a panel PIN kódja |
| `EXPO_ACCESS_TOKEN` | opcionális – Expo push hitelesítés |

Mentsd rendszeresen a `DB_PATH` fájlt. A rate limit memóriában van, ezért egy példányban futtasd.

### App

Állítsd be a szerver címét build előtt (pl. `.env` fájlban vagy az EAS build profilban):

```
EXPO_PUBLIC_API_URL=https://rendeles.erdenskebap.hu
```

Majd: `npx eas-cli@latest build --profile production` és `npx eas-cli@latest submit`.

Az app a saját fejlesztői fiókunkon (Team `8GZ6FU7RBK`) jelenik meg az App Store-ban. Mivel az étterem
nevét és arculatát használja, az App Review kérhet erről engedélyt: legyen meg az étteremtől egy
írásos hozzájárulás a név és a logó használatához, és az App Review megjegyzésben jelezd, hogy a
megbízásukra készült.

### Éttermi panel

Nyisd meg a `https://<szerver>/panel/` címet a pult melletti tableten, lépj be, és koppints a
„Hang” gombra (a böngészők csak érintés után engedik a hangot). A kijelző ne aludjon el.

## Amit élesítés előtt egyeztetni kell az étteremmel

Az adatok forrása: erdenskebap.hu (étlap-szerkezet, színek), @erdenskebab TikTok (címek),
online cégjegyzékek (Monor telefonszám, nyitvatartás). **Nyilvános árlapot nem találtam**, ezért:

| Mit | Hol | Állapot |
| --- | --- | --- |
| Árak, felárak | `src/data/menu.ts` | becsült |
| Italok | `src/data/menu.ts` | példa |
| Szállítási díjak, zónák, minimum | `src/data/locations.ts` | becsült |
| Nyitvatartás | `src/data/locations.ts` | cégjegyzékből, ellenőrizni kell |
| Ételfotók | Unsplash (ingyenes licenc) | cserélendő saját fotókra |
| Logó | „EK” monogram (`assets/images`) | cserélendő a hivatalos logóra |

Az étlapot és az éttermi adatokat **az app és a szerver ugyanabból a fájlból olvassa**, így elég
egy helyen módosítani – utána a szervert újra kell indítani és új app buildet kiadni (vagy `eas update`).

## Még nincs benne

- Online kártyás fizetés (pl. Barion vagy SimplePay) – most csak átvételkori fizetés van
- Termékek elérhetőségének kapcsolása a panelről („elfogyott”)
- Futár-követés térképen
- Vendégfiók / bejelentkezés (a rendeléseket most a telefon tárolja)

## Szerkezet

```
src/app/            app képernyők (Expo Router)
src/components/     UI komponensek, OrderSync (státusz frissítés + értesítések)
src/data/           étlap és éttermek – közös az app és a szerver között
src/lib/            API kliens, értesítések, nyitvatartás, rendelés státuszok (közös)
src/store/          kosár és mentett állapot
server/src/         backend: index.ts (API), orders.ts (ellenőrzés), store.ts (SQLite), push.ts, events.ts
server/panel/       éttermi panel (HTML/CSS/JS)
```

Ellenőrzések: `npx tsc --noEmit`, `npx expo lint`, `npm run server:check`.
