# Spinningskärm: design

Datum: 2026-11-16
Status: väntar på godkännande

## Varför

Triathlonklubben kör gemensam spinning på torsdagar i en mörk sal med en stor skärm längst fram. Alla cyklar på egna inomhuscyklar, ställer sitt eget motstånd och håller koll på sin egen effekt. Det som saknas är en gemensam bild av passet: vad vi kör nu, hur länge till och vad som kommer sen. Appen ska dessutom peppa gruppen med animationer som blir vildare ju hårdare intervallet är och som rör sig i takt med musiken i salen.

Instruktören går igenom passet med gruppen före start och håller koll på det under tiden, med skärmen bakom ryggen.

## Mål

1. Visa passet som staplar (procent av FTP över tid) med en markörlinje som visar exakt var i passet gruppen är.
2. Visa en nedräkning för aktuellt intervall och en klocka för total tid, läsbara från hela salen.
3. Låta instruktören bygga, spara och redigera pass i förväg.
4. Peppa med 3D-animationer i technostil som skalar med intervallets procent av FTP. Elias ord: "more is more".
5. Pulsera i takt med musiken via laptopens mikrofon.
6. Köras i webbläsaren i fullskärm på Elias egen laptop, kopplad till salens skärm, även utan nätverk.

## Icke-mål

- Mäta eller visa någon cyklists effekt, puls eller kadens. Ingen koppling till cyklar eller sensorer.
- Konton, inloggning och molnlagring (kommer i steg 2).
- Synkad visning på mobilen (kommer i steg 2).
- Spela upp musik. Musiken kommer från salens anläggning.
- Ljust läge.
- Redigering av pass på mobil. Redigeraren byggs för laptop.

## Anti-mål

Appen har misslyckats, även om den tekniskt fungerar, om något av detta händer:

- Klockorna eller staplarna blir svåra att läsa på grund av animationerna.
- Skärmen bländar i den mörka salen.
- Hårt strobljus eller blink snabbare än tre gånger per sekund (risk för anfall vid ljuskänslig epilepsi).
- Klockan driver från verklig tid, till exempel för att webbläsaren stryper fliken.
- Ett pågående pass tappar sin position om sidan laddas om av misstag.
- Sparade pass försvinner utan att det fanns ett sätt att säkerhetskopiera dem.

## Ramar

- Körs på Elias laptop i en modern Chrome eller Edge. Safari och Firefox är inte krav.
- Mikrofonen kräver att sidan öppnas via `localhost` eller https, så appen startas med ett kommando och inte genom att dubbelklicka på en fil.
- Ska fungera utan nätverk i salen. Inga resurser hämtas från nätet vid körning.
- Ska senare kunna läggas på Vercel med Supabase utan ombyggnad av steg 1.
- Appen startas alltid med samma kommando på samma fasta port (`strictPort` i Vite). Webbläsaren knyter sparade pass och mikrofontillståndet till adressen inklusive port, så en annan port skulle få passen att se försvunna ut.
- Laptopens lock ska vara öppet under passet. En MacBook stänger av mikrofonen när locket fälls ned.
- Målbild för prestanda: 60 bilder per sekund i 1920×1080 på en laptop med inbyggd grafik. 3D-bilden ritas aldrig i högre upplösning än 1920×1080, även om skärmen har fler pixlar.
- All text i gränssnittet är på svenska.

## Vägar som övervägdes

| Väg | Vad den innebär | Varför den valdes eller valdes bort |
|-----|-----------------|-------------------------------------|
| A. Ren HTML, CSS och JavaScript med 2D-canvas | Inga beroenden, inget byggsteg | Var första förslaget. Valdes bort när Elias bad om 3D och så vilda effekter som möjligt. |
| **B. Vite, TypeScript och three.js, utan React** | Ett byggverktyg och ett grafikbibliotek. Gränssnittet skrivs utan ramverk. | **Vald.** three.js ger 3D, glöd och partiklar utan att allt skrivs från grunden. Appen är i övrigt en skärm och ett formulär och behöver inget gränssnittsramverk. |
| C. React med react-three-fiber | Som B men med React för gränssnittet | Mer beroenden och mer kod utan att det svåra (klocka, takt, animationer) blir enklare. Kan väljas senare om redigeraren växer. |
| D. Next.js | Standard på Vercel | Allt händer i webbläsaren och inget på servern, så maskineriet skulle stå oanvänt. |

Elias valde 3D-spåret uttryckligen ("ju vildare effekter desto bättre, även om det är mer jobb"). Valet av just Vite, TypeScript och three.js utan React är Claudes.

## Det Elias har bestämt

- Appen körs på hans egen laptop som kopplas in i salens skärm.
- Steg 1 är helt lokalt. Steg 2 är Vercel och Supabase, med synkad visning på mobilen så att instruktören ser läget utan att vända sig om.
- Endast mörkt läge.
- Staplarna ser ut ungefär som i exempelbilden han skickade: färg efter intensitet, sneda staplar för uppvärmning och nedvarvning, upprepade set med vila emellan.
- Skärmen pulserar lätt i takt med musiken.
- Vid byte av intervall står det tydligt på skärmen vad som händer.
- Peppande ord dyker upp ibland.
- Animationer i stil med Windows Media Player, i 3D, "more is more".
- På de tyngsta intervallerna pulserar även skärmens kanter.

Han har sett och godkänt en skiss av skärmens upplägg (se "Skärmen" nedan) och listan med Claudes förslag om nedräkning före byte, mjuk puls med tak, avstängningstangent och redigerbara peppord.

## Appens delar

Appen har tre vyer med adresser i webbläsarens hash-del, så att den fungerar som statiska filer.

### 1. Biblioteket (`#/`)

Lista över sparade pass med namn, total tid och en liten förhandsbild av staplarna. Härifrån kan man skapa nytt pass, öppna ett pass i redigeraren, duplicera, ta bort (med bekräftelse) och starta ett pass på skärmen. Här finns också export av alla pass till en JSON-fil och import från en sådan fil.

Första gången appen öppnas finns tre exempelpass: ett sweetspot-, ett tröskel- och ett VO2max-pass, så att det finns något att titta på direkt.

### 2. Redigeraren (`#/edit/<id>`)

Ett pass är en ordnad lista av block och grupper.

- **Block:** längd (minuter och sekunder), procent av FTP vid start, procent av FTP vid slut och ett valfritt namn. Är start och slut lika blir stapeln platt, annars sned.
- **Grupp:** en lista av block och ett antal upprepningar, till exempel 4 × (2 min 105 % + 1 min 95 %). Grupper kan inte innehålla grupper.

Man kan lägga till, ta bort, flytta upp och ned samt duplicera både block och grupper. Två set med vila emellan bygger man genom att duplicera gruppen och lägga ett vilblock emellan. Staplarna ritas om direkt när något ändras, och total tid visas hela tiden. Ändringar sparas automatiskt.

Block utan namn får namn efter sin zon ("Tröskel"). Block i en upprepad grupp numreras på skärmen ("Tröskel 2 av 4"). Om två block intill varandra skulle få samma namn läggs procenten till ("Tröskel 105 %" och "Tröskel 95 %").

Sneda block:

- Ett stigande block först i passet heter "Uppvärmning" och ett fallande block sist heter "Nedvarvning". Övriga sneda block får namn efter zonen för sitt medelvärde.
- Stapeln färgas som en övergång mellan startzonens och slutzonens färg.
- I text skrivs procenten som "50 → 75 %".

Gränser: procent 20 till 200, längd 5 sekunder till 3 timmar per block, upprepningar 1 till 50.

### 3. Skärmen (`#/run/<id>`)

Skärmen har tre lägen.

**Före start: överblick.** Hela passet som stora staplar med namn, total tid och en hopfälld lista över passets block, där grupper skrivs som "4 × (2 min 105 % + 1 min 95 %)". Lugn bakgrund. Instruktören går igenom passet med gruppen härifrån. Här finns också en liten panel för mikrofonen: nivåmätare, känslighet och en lampa som blinkar på varje upptäckt slag, så att man ser att takten fångas innan passet startar.

**Under passet.** Upplägget som Elias har godkänt:

```
┌──────────────────────────────────────────────────────────────┐
│ Tröskel 4 × 8 min                 Total tid  23:41 av 68:30  │
│                                                              │
│ Tröskel 2 av 4                                               │
│ 100  % av FTP                                   05:12        │
│ Nästa: Vila · 03:00 · 55 %               kvar av intervallet │
│                                                              │
│  ░░▒▒ ▌ ▌ ▌  ████  ████│ ████  ████   ▒▒░░                   │
│  (passerat är nedtonat)│markörlinje                          │
└──────────────────────────────────────────────────────────────┘
        3D-animationen fyller hela bakgrunden bakom allt
```

- Total tid är tiden som har gått, som räknar uppåt, med passets längd bredvid.
- Procentsiffran får en ljus ton av zonens färg. Vid sneda block visar den aktuell procent just nu.
- De sista fem sekunderna före ett byte räknas ned stort mitt på skärmen. Nedräkningen visas bara om blocket är minst 15 sekunder långt.
- Vid bytet visas en banderoll över hela skärmen i tre sekunder med det nya blockets namn, procent och längd. Om banderoll och nedräkning skulle krocka på korta block går banderollen före.
- Peppord visas stort i några sekunder med ojämna mellanrum: ungefär var 90:e sekund vid 88 % av FTP och var 25:e sekund vid 120 %. Det är aktuell procent som räknas, inte blockets medelvärde. Under 88 % visas inga peppord, och aldrig under de sista tio sekunderna av ett block eller samtidigt som banderollen.
- Muspekaren göms efter tre sekunder utan rörelse.
- Skärmen hålls vaken med Screen Wake Lock, som begärs på nytt när fliken blir synlig igen.

**Efter passet.** "Bra jobbat", total tid och lugn bakgrund. Härifrån går man tillbaka till biblioteket.

**Tangenter under passet**

| Tangent | Gör |
|---------|-----|
| Mellanslag | Starta, pausa, fortsätta |
| Pil höger | Hoppa till nästa block |
| Pil vänster | Tillbaka till början av blocket. Inom de första tre sekunderna: föregående block. |
| Pil upp, pil ned | Höj eller sänk mikrofonens känslighet |
| F | Fullskärm av och på |
| A | Animationer av och på |
| M | Mikrofon av och på. Av betyder att den interna takten används. |
| Q | Avsluta passet, efter bekräftelse |

Esc lämnas åt webbläsaren, som använder den för att gå ur fullskärm. Sidan får inte den tangenttryckningen i fullskärm, så den kan inte användas för att avsluta passet.

Vid paus stannar klockorna, "Pausad" visas tydligt och animationen lugnar ned sig.

Efter en omladdning mitt i passet fortsätter klockan på rätt ställe, men webbläsaren kräver en ny tangenttryckning för fullskärm och ljud. Skärmen visar då "Tryck F för fullskärm" tydligt tills det är gjort.

## Zoner och färger

Färgerna väljs för svart bakgrund. Gränserna ligger som konstanter på ett ställe.

| Zon | Från och med (procent av FTP) | Färg |
|-----|-------------------------------|------|
| Vila | 0 | grå |
| Lugnt | 60 | blå |
| Tempo | 76 | grön |
| Sweetspot | 88 | gul |
| Tröskel | 95 | orange |
| VO2max | 106 | röd |

Varje zon gäller upp till nästa zons gräns, så det finns inga luckor för värden med decimaler. Gränserna är Claudes förslag efter vanliga träningszoner.

Zonfärgerna används i ljusa toner för text, eftersom mättad blå och röd inte går att läsa mot svart.

## Klockan

Klockans läge är tre värden: om den går, en tidpunkt på väggklockan (ankaret) och positionen i passet vid ankaret. Positionen just nu räknas alltid fram ur väggklockan:

```
position = går ? positionVidAnkare + (nu − ankare) : positionVidAnkare
```

Start, paus och hopp sätter bara ett nytt ankare. Ingenting räknas upp bild för bild, så klockan kan inte driva även om fliken stryps. Läget sparas i webbläsaren vid varje ändring, så att en omladdning fortsätter på rätt ställe. Samma tre värden är det som skickas till mobilen i steg 2.

Det finns bara ett sparat läge åt gången. Det rensas när passet avslutas med Q och när passet har gått klart. Det återupptas bara om det gäller samma pass, passet inte har redigerats sedan dess och läget är yngre än fyra timmar. I alla andra fall visas överblicken före start.

Uppslagningen från position till aktuellt block, återstående tid och aktuell procent är rena funktioner utan sidoeffekter.

## Ljudet

- Mikrofonen öppnas med ekosläckning, brusreducering och automatisk nivå avstängda, så att basen inte filtreras bort.
- Ljudet analyseras i tre band (bas, mellan, diskant) som animationerna kan läsa av.
- Ett slag räknas när energin i basen (ungefär 40 till 150 Hz) plötsligt stiger över sitt eget glidande medelvärde. Tröskeln anpassar sig alltså efter ljudnivån i salen. Känsligheten kan justeras i panelen före start och med piltangenterna under passet. Frekvensbandets gränser är ställbara i panelen, eftersom laptopmikrofoner ofta dämpar den djupaste basen.
- Efter ett slag ignoreras nya slag i 400 ms. Det ger högst 2,5 slag per sekund, vilket håller pulserna under säkerhetstaket med marginal.
- Om mikrofonen nekas, saknas eller ljudnivån är låg i mer än fem sekunder tar en intern takt på 130 slag per minut över, så att animationerna fortsätter röra sig. Ett lugnt parti i musiken utan bastrumma räknas inte som tyst. En liten ikon visar vilket läge som gäller.

**Känd risk.** Det här är den osäkraste delen av appen och går bara att avgöra på plats. Laptopmikrofonen dämpar bas, salens efterklang smetar ut slagen och instruktörens röst ligger i samma frekvensområde. Pulsen kommer dessutom uppskattningsvis 100 till 200 ms efter ljudet. På jämn techno bör det fungera, på blandad musik är det osäkert. Därför byggs mikrofonpanelen först och provas i salen innan animationerna byggs (se "Byggordning").

## Animationerna

Varje scen får samma indata varje bildruta: en intensitet från 0 till 1, en slagpuls som stiger snabbt men mjukt på varje slag och klingar av, nivån i de tre ljudbanden (utjämnad så att den inte flimrar), zonens färg och tiden.

Intensiteten räknas ur aktuell procent av FTP: 50 % ger 0 och 120 % ger 1, med mjuk övergång vid blockbyten.

**Scener**

1. **Tunneln.** Kameran flyger genom en tunnel av lysande ringar. Farten och vridningen följer intensiteten, ringarna tänds på slagen.
2. **Nätlandskapet.** Ett lysande rutnät rullar mot kameran, och bergens höjd formas av ljudbanden.
3. **Partikelsvärmen.** Tusentals partiklar som trycks utåt på varje slag. Antalet följer intensiteten.
4. **Spektrumringen.** Staplar i 3D i en ring runt kameran, i stil med Windows Media Player.

Scenen byts vid nytt block, aldrig till samma som nyss och högst var 20:e sekund, så att korta intervaller inte ger ständiga byten. Bytet sker som en övertoning och inte som ett klipp. Under vila väljs en lugn variant med låg fart och dämpat ljus.

**Effekter ovanpå scenerna**

- Glöd (bloom) som ökar med intensiteten.
- Kameraskak från intensitet 0,8.
- Färgsplittring och störningseffekter på VO2max-block. Störningarna förskjuter remsor av bilden i sidled och ändrar inte ljusstyrkan.
- En ram runt skärmens kanter som pulserar på slagen. Den tänds från 95 % av FTP och blir starkare upp till 120 %.

**Läsbarhet.** Text, klockor och staplar ritas som vanlig HTML ovanpå 3D-bilden, med en mörk platta bakom som täcker minst 85 %. Kontrasten mellan text och det som syns bakom ska hålla sig över 7:1 även när bakgrunden är som ljusast. Animationen får sitt utrymme runt och mellan plattorna, inte bakom texten.

**Säkerhet.** Reglerna är mätbara så att de går att kontrollera:

- Skärmens medelljusstyrka får ändras högst 10 % per puls.
- Pulser kommer högst 2,5 gånger per sekund (se "Ljudet").
- Ljudbandens nivåer jämnas ut innan de styr något som lyser, så att inget flimrar snabbare än pulserna.
- Inga hårda växlingar mellan svart och vitt över hela bilden och inga mättat röda helskärmsblink.
- Tangenten A stänger av allt utom en stilla mörk bakgrund.

De enskilda sakerna i bilden får gärna vara vilda. Det är bildens sammanlagda ljus som hålls lugnt.

**Prestanda.** Upplösningen på 3D-bilden och antalet partiklar sänks automatiskt om bildfrekvensen i snitt faller under 50 bilder per sekund, och höjs igen när det finns marginal.

## Lagring

All sparning och laddning av pass går genom en enda modul med funktionerna lista, hämta, spara, ta bort, exportera och importera. Funktionerna är asynkrona redan nu, så att bytet från webbläsarens lagring till Supabase i steg 2 sker i den modulen och ingen annanstans.

Import kontrollerar filens innehåll mot samma gränser som redigeraren och avvisar det som inte stämmer, med ett begripligt felmeddelande. Import lägger till pass och skriver inte över befintliga.

Peppordens lista sparas på samma sätt och redigeras i en enkel inställningsruta i biblioteket.

## Test

- Automatiska tester (Vitest) av de rena delarna: utplattning av grupper till block, klockans position, uppslagning av aktuellt block, slagdetektorn mot en konstgjord signal, intensitetskurvan och importkontrollen.
- Animationerna och skärmens upplägg kontrolleras för hand i webbläsaren, bland annat med ett helt pass uppspelat i hög fart.
- Ett utvecklingsläge (`?fart=30`) spelar upp passet snabbare, så att ett helt pass kan granskas på ett par minuter.

## Byggordning

1. Pass, redigerare, lagring och klocka, med staplar och klockor på skärmen utan animationer. Detta går att använda på ett pass direkt.
2. Mikrofonpanelen med nivåmätare och slaglampa. Elias provar den i salen med musiken igång innan något mer byggs på ljudet.
3. Animationerna, först drivna av den interna takten och sedan av mikrofonen, justerade efter vad provet i salen visade.

## Steg 2 (byggs inte nu)

- Publicering på Vercel som statiska filer.
- Supabase för inloggning och lagring av pass, via lagringsmodulen.
- Följvy på mobilen: klockans tre värden skickas via Supabase Realtime, och mobilen räknar fram samma position själv. Mobilen visar klockor och staplar utan animationer.

## Lämnas åt byggaren

- Scenernas exakta utseende, färgskalor och kamerarörelser.
- Standardlistan med peppord.
- Typsnitt och exakt typografi, så länge siffrorna har fast bredd och går att läsa på tio meters håll.
- Filstruktur och uppdelning i moduler, utöver att lagring, klocka, ljud och animation hålls isär.
- Exempelpassens exakta innehåll.
