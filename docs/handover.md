# Handover: Spinningskärmen (senast uppdaterad 24 november 2026)

Klubbskärm för spinningpass i Triathlon Västs färger, med rave-effekter, inloggning och följvy på mobilen.
Koden ligger på GitHub i `ewennersten/spin` (publikt) och publiceras automatiskt till
https://spinmaggedon.vercel.app vid varje push till `main`. Alla 150 tester och bygget går igenom.

Kör appen med `npm run dev` och öppna `http://localhost:5173`. Kör testerna med `npm test`. Lokalt läses
Supabase-värdena från `.env.local` (ignoreras av git). Serverinställningen `spinningskarm-lokal` i
`.claude/launch.json` kör appen utan Supabase, alltså utan inloggning och med passen i webbläsaren.

## Senaste sessionen (23–24 november): publicering, Supabase och följvy
- **Vercel**: projektet `spin` på det privata kontot `ewennersten`, kopplat till GitHub. Miljövariablerna
  `VITE_SUPABASE_URL` och `VITE_SUPABASE_PUBLISHABLE_KEY` ligger i Vercel.
- **Supabase**: projektet `spin` (`bnlhpjzhjdmbktskjsoh`, Stockholm) i den privata organisationen. Schemat ligger i
  `supabase/migrations/`. Tabeller: `profiles` (ett konto per inloggning, `approved` sätts av Elias),
  `workouts` (passen som JSON, en rad per konto och pass) och `live_runs` (passet som pågår, för följvyn).
  Behörighetsreglerna släpper bara in godkända konton och bara till deras egna rader.
- **Inloggning** med e-post och lösenord (`src/ui/login.ts`). Vem som helst kan registrera sig, men kontot måste
  godkännas: sätt `approved` till `true` i tabellen `profiles`. Utan Supabase-variablerna fungerar appen som förut.
- **Passen i molnet** (`src/storage/cloud.ts`) är privata eller delade (`shared`). Ägaren (`user_id`) ändrar,
  delar och tar bort; andra godkända konton ser delade pass och kan köra och duplicera dem. `id` är primärnyckel. Inställningar (peppord, mikrofon, animationer, ljusspärr) och
  pågående pass ligger kvar i webbläsaren, eftersom de hör till datorn i salen. Datorns pass laddas upp en gång
  när ett konto loggar in och molnet är tomt. **Utan nät går inga pass att öppna.**
- **Följvyn** (`src/ui/follow.ts`, adressen `#/folj`): mobilen, inloggad med samma konto, visar passet som pågår på
  datorn, utan animationer. Datorn skickar klockans läge vid start, paus, hopp, avslut och när ett pass återupptas;
  mobilen räknar fram positionen själv via Supabase Realtime. Mobilen och datorn behöver gå på nätets tid.
- **Fågelscenen** (flocken) flyger efter en osynlig ledare i åttor genom bilden och visas bara upp till 70 % av FTP
  (`SCENE_MAX_PCT` i `src/anim/scenes/index.ts`).
- **Scenbyten**: vid nytt block (högst var 20:e sekund) och dessutom var 3:e minut mitt i långa block. Bytet tonas
  genom svart på 0,6 + 0,6 sekunder (`src/anim/stage.ts`). Användaren har sett det och vill ha det så.

## Vad som finns nu

### Bibliotek och meny
- Sidhuvud i tridräktens färger (rött som tonar till svart) med klubbens logga, en tagline och flikarna **Pass**
  och **Peppord**. En EKG-liknande pulskurva sveper genom sidhuvudet (`src/ui/pulse.ts`).
- Favicon med cykeln ur loggan (`public/favicon.png`).
- Pass som pågår syns i biblioteket med **Fortsätt** och **Stoppa**.
- Peppord läggs till och tas bort ett i taget i fliken Peppord.
- Exempelpass: Sweetspot, Tröskel, VO2max och **Sprint 10 × 30 s på 150 %**. Nya exempelpass läggs till i ett
  befintligt bibliotek en gång per pass (`spinning.examples.v1` minns vilka som erbjudits).

### Passkärmen
- **Staplar i UV-neon** (`src/ui/chart.ts`): zonfärg som mörknar mot vinrött, röd och cyan kontur, skanlinjer som
  rör sig uppåt. På slaget glider konturen isär och stapeln som pågår hoppar isär i remsor. Under passet står
  staplarna vid skärmens underkant; på startskärmen och i biblioteket speglas de i ett golv.
- **Skalor**: procent av FTP till vänster i zonernas färger, **Borgskalan 6–20** till höger i Borgtavlans färger.
  Skalans topp är passets högsta procent plus 8 %, uppåt till jämna 5 (steg om 50 % över 200).
- **Zoner**: ny zon **Anaerob** från 121 % i mörkrött. Block får vara upp till 300 % av FTP.
- **Texter**: procenten och nedräkningen tonar till zonens färg och glöder på slaget. De vita texterna har röd och
  cyan kant, och kanten på blockets namn glider isär på slaget. Raden "Nästa" står i nästa zons färg.
  Inga plattor bakom texterna längre, och ingen kantram runt skärmen.
- **Blockbyte**: blockets namn visas mitt på skärmen utan platta, och det bakom tonas ned.
- **Peppord** mitt på skärmen med sex slumpade animationer in och ut (slår in och släcks som en tv, bokstäver som
  faller, neonskylt, flyger in, avkodas, delas på mitten). Se `docs/ideer/peppord.md`.
- **Uppbyggnad** (`src/anim/buildup.ts`) de sista tio sekunderna före och i slutet av hårda block: streck mot
  mitten, en ring som pulserar allt oftare och mörkare kanter.
- **Rave-effekter** (`src/anim/drops.ts`) när ett hårt block är klart eller börjar: sex varianter som slumpas
  (Hyperfart, Golvvåg, Glitchchock, Ljudvåg, Equalizer, Pulsringar), med mjuk uttoning. Fyrverkeriet är borttaget.
- **Q och R** börjar om passet, **pil höger** och klick på "Nästa" hoppar till nästa block.

### 3D-bakgrunden
- Sju vanliga scener: tunnel, rutnät, partikelsvärm, ring, **klot**, **flock** (bara upp till 70 %) och **kalejdoskop**.
- Sex **viloscener** som bara visas i vila, alltså block som som högst ligger under 60 % av FTP (`src/anim/scenes/vila.ts`):
  discokula, rymdfärd, lavalampa, rutnät som andas, roterande geometri och partikelmoln. De är gråa som vilozonen,
  rör sig långsamt och följer inte musiken. Byte mellan vila och annat sker direkt (`SceneDirector` i `src/anim/drive.ts`).
- `?scen=N` visar en scen: 1–7 är de vanliga och 8–13 viloscenerna. `?fart=N` snabbar upp klockan.

### Musikens takt
- Ljudkälla: mikrofonen eller **datorns ljud** (via skärmdelning i Chrome). En ruta visas i tio sekunder om källan tappas.
- Slagen hittas med **aubio** (paketet `aubiojs`, GPL-licens) och förutses ur låtens takt (`src/audio/predict.ts`),
  så att pulsen kan komma före slaget. **Synk**-reglaget (0–300 ms, från början 120) flyttar pulsen tidigare.
  Går aubio inte att ladda används den egna slagdetektorn.
- Pulsen slår direkt, utan uppgång. Pulsen blinkar högst 2,5 gånger per sekund.

### Ljus och tillgänglighet
- **Ljusspärren** är nu ett reglage i överblicken, **avstängt från början**. På: 3D-bilden blir aldrig ljusare än
  en femtedel av helvitt och ljusnar långsamt, och effekterna dämpas utan glitch och ryck.
- **A** stänger av animationerna. Minskade rörelser i datorn stänger av rörelserna.

## Sparade idéer
- `docs/ideer/staplar.md`: stapelstilarna, med UV-neon som byggd.
- `docs/ideer/peppord.md`: peppordens animationer.
- `docs/ideer/viloscener.md`: viloscenerna, även de bortvalda (andningsring, norrsken, stilla hav, regn, droppar m.fl.).

## Prövat och inte prövat
- Allt nytt är kontrollerat i webbläsarens förhandsvisning med skärmbilder och mätningar. Förhandsvisningen ritar
  få bildrutor, så **inget är sett i full fart**.
- **Inte provat i salen**: storskärmen, projektorns fördröjning, ljusstyrkan utan ljusspärr, läsbarheten på långt håll.
- **Inte provat med riktig musik**: aubio och förutsägelsen är mätta med konstgjorda låtar. Användaren tyckte att
  pulsen fortfarande kom sent; en tröskel på nivåmätaren provades och rullades tillbaka.

## Öppet och att tänka på
- Takten är det som fungerar sämst. Nästa steg är att prova med riktiga låtar och ställa in Synk i salen.
- aubio är GPL-licensierat. Appen och repot är nu publika men repot saknar licens; förslaget är GPL-3.0, och
  beslutet är användarens.
- Salen måste ha nät, eftersom passen ligger i molnet. Är nätet dåligt kan passen även sparas lokalt.
- Supabase föreslår skydd mot läckta lösenord (Authentication → Providers → Email); det slår användaren på själv.
- Supabases inbyggda e-post klarar bara ett par mejl i timmen, och ingen avisering skickas när ett konto väntar
  på godkännande.
- Ljusspärren är avstängd från början. Den bör slås på om någon i gruppen är ljuskänslig.
- Bygget varnar för att three.js-delen är över 500 kB och för att aubiojs nämner Node-modulerna `fs` och `path`.
  Det påverkar inte appen i webbläsaren.
- Förslag som inte byggts: puls i startmenyn, ljuskäglor, publik med händer, baspump, rökmaskin, neon över 3D-bilden.
- Inte påbörjat: finjustering av mikrofonen efter test i salen.

## Arbetssätt
- Commit bara när användaren ber om det, med meddelande på svenska och raden
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Svara på svenska. Visa gärna förslag som skisser innan något byggs; användaren väljer ofta bland tre.
- Använd exakta sökvägar och undvik `cd`.
