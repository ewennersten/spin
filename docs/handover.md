# Handover: utseende, takt och rave-effekter (17–20 november 2026)

Den här sessionen gjorde om appens utseende och känsla: från en saklig passkärm till en klubbskärm i Triathlon
Västs färger med rave-känsla. Allt är incheckat på `main` (från `d472a7e` till `ea74033`). Det finns ingen
fjärrkopia. Alla 142 tester och bygget går igenom.

Kör appen med `npm run dev` och öppna `http://localhost:5173`. Kör testerna med `npm test`.

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
- Sju vanliga scener: tunnel, rutnät, partikelsvärm, ring, **klot**, **flock** och **kalejdoskop**.
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
- aubio är GPL-licensierat. Läggs appen ut öppet på nätet bör appens kod också vara öppen.
- Ljusspärren är avstängd från början. Den bör slås på om någon i gruppen är ljuskänslig.
- Bygget varnar för att three.js-delen är över 500 kB och för att aubiojs nämner Node-modulerna `fs` och `path`.
  Det påverkar inte appen i webbläsaren.
- Förslag som inte byggts: puls i startmenyn, ljuskäglor, publik med händer, baspump, rökmaskin, neon över 3D-bilden.
- Tidigare planer som inte påbörjats: Vercel och Supabase med synk till mobilen, finjustering av mikrofonen efter
  test i salen.

## Arbetssätt
- Commit bara när användaren ber om det, med meddelande på svenska och raden
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Svara på svenska. Visa gärna förslag som skisser innan något byggs; användaren väljer ofta bland tre.
- Använd exakta sökvägar och undvik `cd`.
