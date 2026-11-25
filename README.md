# Spinningskärm

Appen visar spinningpasset på storskärmen i salen: vad ni kör nu, hur länge till och vad som kommer sedan. Den lyssnar också på musiken genom laptopens mikrofon och letar efter takten, främst i basen men även i virvel och hi-hat.

Använd Chrome eller Edge.

## Öppna appen

Öppna **https://spinmaggedon.vercel.app** i Chrome eller Edge. Appen uppdateras av sig själv när en ny version läggs ut.

Datorn i salen behöver nät. Passen ligger på servern, så utan nät går inga pass att öppna. Ett pass som redan har startat fortsätter att gå om nätet försvinner, men följvyn på mobilen tappar då kontakten.

## Konto och inloggning

Första gången klickar du **Skapa konto**, fyller i e-post och ett lösenord på minst 8 tecken och bekräftar e-postadressen via länken i mejlet. Kontot måste sedan godkännas innan det kommer åt några pass; tills dess står det att kontot väntar på att bli godkänt. Den som administrerar appen godkänner kontot i Supabase, i tabellen `profiles`, genom att sätta `approved` till `true`.

Du förblir inloggad på datorn tills du klickar **Logga ut** längst ned i biblioteket. Ett nytt pass är privat. Klicka **Dela** för att alla godkända konton ska se det, och **Sluta dela** för att göra det privat igen. Ett pass som någon annan har delat står som *Delat med dig*: det går att köra och duplicera, och kopian blir ditt eget pass att ändra. Bara den som skapade ett pass kan ändra, dela och ta bort det.

Första gången ett konto loggar in på en dator laddas de pass som redan fanns i den webbläsaren upp, om det inte redan finns pass i molnet. Det sker bara en gång per konto och dator.

Peppord, mikrofonens inställningar, animationerna och ljusspärren sparas i webbläsaren på datorn, inte på kontot. Ställ in dem på datorn i salen.

## Följ passet på mobilen

Logga in med samma konto på mobilen och tryck **Följ passet på mobilen** längst ned i biblioteket (adressen är `https://spinmaggedon.vercel.app/#/folj`). Mobilen visar passet som pågår på datorn: blocket, procenten, nedräkningen, nästa block och staplarna, utan animationer. Den följer med när passet startar, pausas, hoppar och avslutas, och skärmen hålls tänd så länge vyn är öppen. När inget pass pågår står det **Inget pass pågår**.

Mobilen räknar fram klockan själv, så mobilens och datorns klockor behöver gå lika. Det gör de om båda hämtar tiden från nätet, som de brukar göra.

## Säkerhetskopiera passen

Klicka på **Exportera pass** i biblioteket. Då hamnar en fil som heter `spinningpass-` följt av datumet i mappen Hämtade filer. Spara filen någon annanstans också, till exempel i molnet.

Med **Importera pass** läser du in en sådan fil igen. Passen i filen läggs till, och inget av de pass som redan finns skrivs över.

Exporten innehåller passen. Peppord och mikrofonens inställningar följer inte med.

## Köra appen på den egna datorn

För utveckling, eller om salen saknar nät, går appen att köra på datorn. Node.js måste finnas; saknas det, hämta LTS-versionen från nodejs.org.

1. Öppna programmet Terminal.
2. Skriv `cd` och ett mellanslag, dra mappen *Spinning spel* från Finder in i terminalfönstret och tryck Enter.
3. Första gången, och bara då, kör du `npm install`.
4. Starta appen med `npm run dev` och öppna `http://localhost:5173/` i Chrome eller Edge.

Låt terminalfönstret vara öppet så länge appen används, och stäng appen med Ctrl+C. Säger terminalen att port 5173 är upptagen kör appen kanske redan i ett annat terminalfönster: öppna adressen och se efter innan du stänger något.

Finns filen `.env.local` med Supabase-värdena (`VITE_SUPABASE_URL` och `VITE_SUPABASE_PUBLISHABLE_KEY`) loggar du in som på webben. Utan den ligger passen bara i webbläsaren och är knutna till adressen `http://localhost:5173`; med en annan adress, port eller webbläsare ser det då ut som att passen är borta.

## Locket ska vara öppet

Ha laptopens lock öppet under hela passet. En MacBook stänger av mikrofonen när locket fälls ned, och då går appen över till intern takt. Har locket ändå fällts ned och det står Intern takt fast musiken spelar: ladda om sidan, se "Om mikrofonen försvinner" nedan.

## Tangenterna

| Tangent | Gör |
|---------|-----|
| Mellanslag | I överblicken: startar passet, även när reglaget eller ett talfält i mikrofonpanelen har fokus. Under passet: pausar och fortsätter. Står fokus på en knapp trycker mellanslag på knappen. |
| Pil höger | Hoppar till nästa block. I sista blocket gör den ingenting. Samma sak händer om du klickar på lappen **Nästa** under klockan. |
| Pil vänster | Går tillbaka till början av blocket. Under blockets första tre sekunder: till föregående block. |
| Pil upp, pil ned | Under passet: höjer eller sänker mikrofonens känslighet ett steg. Värdet sparas. |
| F | Fullskärm av och på. |
| A | I överblicken och under passet: stänger av och sätter på animationerna. Överblicken visar valet under "Mellanslag startar passet", så att du kan stänga av före start. Har du just rört mikrofonpanelen: klicka utanför den först, annars går tangenten till panelen. Valet sparas, till skillnad från M, och gäller även efter en omladdning och nästa pass. Saknar datorn stöd för 3D-grafik gör A ingenting. |
| M | Under passet: växlar mellan mikrofonen och den interna takten. Mikrofonen är fortfarande öppen, så webbläsarens mikrofonsymbol lyser kvar. Valet sparas inte: efter en omladdning används mikrofonen igen. |
| Q | I överblicken: tillbaka till biblioteket, som länken **Till biblioteket** (använd länken om du just har rört mikrofonpanelen). Under passet: frågar om passet ska avslutas. Enter avslutar, R börjar om från början, valfri annan tangent fortsätter. |

Esc lämnar fullskärm men avslutar inte passet.

Laddas sidan om mitt i passet fortsätter klockan där den var. Tryck F för att få fullskärm igen.

Ett pass som lämnades utan Q, till exempel med bakåtknappen eller en stängd flik, återupptas när du trycker **Starta** vid samma pass igen inom fyra timmar, om passets tid inte redan har gått ut. Klockan har gått under tiden: lämnade du passet vid 20:00 och kommer tillbaka fem minuter senare visar skärmen 25:00. Bara ett pausat pass står kvar där det var. I biblioteket syns ett sådant pass med ett rött streck och texten **Pågår vid** eller **Pausat vid** och tiden där klockan stod när biblioteket öppnades. Där står **Fortsätt** i stället för **Starta**, och **Stoppa** rensar läget så att passet börjar om från början nästa gång. Under passet kan du också börja om från början: tryck **Q** och sedan **R**. Då visas överblicken igen, med klockan på noll, och där kan du också välja mikrofon eller datorns ljud på nytt.

## Mikrofonen

Klicka på **Starta** vid ett pass i biblioteket. Överblicken som då visas, före start, har en liten panel för mikrofonen. Panelen finns inte i **Redigera**.

- **Slå på mikrofonen** öppnar mikrofonen. Första gången frågar webbläsaren om lov.
- **Nivå** visar hur mycket mikrofonen hör.
- **Lampan** blinkar i takt med pulsen. I läget Intern takt är den släckt.
- **Mikrofon** eller **Intern takt** visar vilket läge som gäller just nu. Står det Intern takt används inte mikrofonen. När appen har hittat låtens takt står den efter källan, till exempel **Mikrofon, 128 slag per minut**.
- **Känslighet** (1 till 10): högre ger fler slag, lägre ger färre. Gäller bara appens egen slagdetektor, som används om aubio inte går att ladda (se nedan).
- **Basband** är de frekvenser som appen räknar som bas, från 20 till 500 Hz. Från början 40 till 150 Hz. Animationen rör sig med basen i bandet. Den egna slagdetektorn låter basen väga dubbelt, men räknar även virvel och hi-hat.
- **Synk** (0 till 300 ms, från början 120): hur långt före slaget pulsen visas. Ljudfångsten, datorn och skärmen eller projektorn gör att pulsen annars kommer efter musiken. Känns pulsen sen, dra uppåt; kommer den före trumman, dra nedåt.

Slagen hittas med [aubio](https://aubio.org/), ett beprövat program med öppen källkod för att följa takten i musik (paketet aubiojs, GPL-licens). aubio får ljudet i bitar om 5 ms och förutser själv var slagen kommer. Går aubio inte att ladda använder appen sin egen, enklare slagdetektor. När slagen går i jämn takt räknar appen ut låtens takt och förutser nästa slag. Då kommer pulsen i tid med musiken, enligt Synk, och fortsätter även över slag som inte hörs. Efter ett byte av låt tar det några sekunder innan takten är hittad; under tiden följer pulsen de slag appen hör, en aning efter musiken. Hörs ingen jämn takt på åtta slag släpper appen den.

Reglaget sparas direkt. Ett talfält gäller och sparas först när du trycker Enter eller Tab, klickar utanför fältet eller startar passet med mellanslag. Inställningarna finns kvar nästa gång.

Mellanslag startar passet även när reglaget eller ett talfält har fokus. Pilarna går till reglaget eller talfältet så länge det har fokus.

Under passet visas inte vilket läge som gäller, så att skärmen bara visar passet. Kontrollera läget i panelen i överblicken före start.

Appen går över till **intern takt** (130 slag per minut) när mikrofonen är avstängd, inte är tillåten eller har varit tyst i mer än fem sekunder. När ljudet kommer tillbaka efter tystnad gäller mikrofonen igen. Klockorna påverkas aldrig av ljudet.

Har du redan tillåtit mikrofonen startar den vid första tangenttryckningen eller klicket, även efter en omladdning mitt i passet.

### Lyssna på datorns ljud i stället

Spelar du musiken från samma dator kan appen lyssna direkt på datorns ljud. Då hör den takten utan att salens ljud, rösten eller mikrofonens svaga bas stör.

1. Klicka **Lyssna på datorns ljud** i panelen **Musikens takt**.
2. Chrome frågar vad som ska delas. Välj **Hela skärmen** och slå på att systemljudet delas. Spelar musiken i en Chrome-flik (till exempel Spotify på webben) kan du i stället välja den fliken och slå på flikens ljud.
3. Klicka **Dela**. Det ska stå **Datorns ljud** i panelen.

Systemljud från hela skärmen kräver en ny Chrome (version 141 eller senare) och macOS 14.2 eller senare. Bilden från skärmen används inte. Klickar du **Sluta dela**, eller tappas ljudet på annat sätt, går appen över till intern takt, och under passet visas i tio sekunder en ruta uppe vid kanten: **Datorns ljud tappades. Takten är intern nu.** Samma ruta visas med **Mikrofon** om mikrofonen kopplas ur. Laddas sidan om mitt i passet visas ingen överblick, så då går datorns ljud inte att välja igen förrän nästa pass. Mikrofonen startar i stället av sig själv, om den är tillåten, och **M** växlar till intern takt.

### Om mikrofonen inte är tillåten

Har mikrofonen nekats en gång frågar webbläsaren inte igen. Klicka då på symbolen till vänster om adressen, tillåt mikrofonen och ladda om sidan.

Samma meddelande visas om macOS inte tillåter webbläsaren att använda mikrofonen. Öppna då Systeminställningar, Integritet och säkerhet, Mikrofon, och slå på Chrome (eller Edge). Starta om webbläsaren om den ber om det.

### Om mikrofonen försvinner

Om mikrofonen försvinner mitt i passet, till exempel för att locket har fällts ned eller en mikrofon har kopplats ur, går appen över till intern takt. Håll därför locket öppet under passet. Står det Intern takt fast musiken spelar: ladda om sidan. Klockan fortsätter där den var, och mikrofonen startar vid första tangenttryckningen.

## Animationerna

Under passet fyller en 3D-animation bakgrunden. Den blir vildare ju högre procent av FTP ni kör, är lugn i vilan och under paus, och pulserar i takt med musiken (eller den interna takten). Det finns sju scener: en tunnel av sexkantiga ringar, ett rutnätslandskap, en virvel av partiklar, en ring av staplar, ett klot av trådnät som böljer med basen, en flock lysande fåglar som sveper i åttor genom bilden (bara upp till 70 % av FTP, eftersom den är för lugn för hårda intervaller), och ett kalejdoskop som strömmar ut från mitten. I vila (block som som högst ligger under 60 % av FTP) visas i stället bara lugna viloscener, gråa som vilozonen och utan puls i takt: **Discokula**, **Rymdfärd**, **Lavalampa**, **Rutnät som andas**, **Roterande geometri** och **Partikelmoln** (se `docs/ideer/viloscener.md`). Vid nya block byts scenen, högst var 20:e sekund, och i långa block byts den dessutom var tredje minut. Bytet tonar genom mörker på ungefär en sekund. Går passet från vila till ett annat block, eller tvärtom, byts scenen direkt. Passets namn och totaltiden, blockets namn, procenten, klockan och stapelbilden står direkt på animationen, texten med en mörk skugga runt bokstäverna. De vita texterna (passets namn, totaltiden, blockets namn och "av FTP") har en tunn röd och cyan kant, som staplarna, och på slaget glider kanten på blockets namn isär och tillbaka. Nästa blocks namn, tid och procent står i nästa zons färg, till exempel rött inför VO2max och grått inför vila, med glöd och samma kant. I överblicken och efter passet är bakgrunden mörk. Medan frågan om att avsluta visas är bakgrunden också mörk, och animationen tonar sedan upp igen.

Under nedräkningen de sista fem sekunderna står siffran stort mitt på skärmen, och klockorna tonas ned. De sista tio sekunderna av ett hårt block, och av blocket före ett hårt block, byggs spänningen upp, som i en låt precis innan basen kommer tillbaka: streck rusar mot mitten allt tätare och snabbare, en ring pulserar ut allt oftare (högst 2,5 gånger per sekund) och kanterna mörknar. Vid noll tar effekten efter intervallen över; börjar ett hårt block släpps uppbyggnaden med samma rave-effekt, men utan ord. Med ljusspärren lyser uppbyggnaden hälften så starkt, och **A** eller minskade rörelser stänger av den. När ett hårt block (från 76 % av FTP och minst 15 sekunder långt) har körts klart kommer en rave-effekt i två sekunder, som när basen kommer tillbaka i en låt, och ett ord som "Starkt jobbat!" poppar fram. Effekten slumpas bland sex varianter, aldrig samma två gånger i rad: **Hyperfart** (streck och ringar rusar ut från mitten), **Golvvåg** (en våg rullar genom ett rutnätsgolv och skärmen rycker till), **Glitchchock** (förskjutna remsor och en blixtring), **Ljudvåg** (en neonlinje slår ut tvärs över skärmen), **Equalizer** (staplar skjuter upp längs golvet) och **Pulsringar** (neonramar pulserar ut mot kanterna). Hyperfart och Glitchchock låter också hela skärmen glitcha en kort stund. Med ljusspärren på lyser effekten hälften så starkt, och skärmen varken rycker eller glitchar. Hoppar du förbi blocket med pilarna blir det ingen effekt. När ett nytt block börjar står dess namn, procent och längd en stund mitt på skärmen, utan platta, och det bakom tonas ned.

I de tunga blocken (från 88 % av FTP) dyker peppord från fliken **Peppord** upp mitt på skärmen i fyra sekunder, och det bakom tonas ned. Ordet kommer in och går ut med en animation som slumpas varje gång, aldrig samma två gånger i rad: det slår in och släcks som en gammal tv, bokstäverna faller in och flyger iväg, det tänds och slocknar som en neonskylt, det flyger in från djupet och susar förbi, det avkodas ur slumpade tecken eller dess halvor glider ihop och isär. Med ljusspärren, **A** eller minskade rörelser tonas ordet bara in och ut. Animationerna beskrivs i `docs/ideer/peppord.md`.

Staplarna lyser som färg i UV-ljus: zonens färg upptill som mörknar mot vinrött vid golvet, med en röd och en cyan kontur förskjutna åt var sitt håll som på en glitchad skärm. Under passet rör sig tunna skanlinjer uppåt i staplarna, och på varje slag glider konturerna isär på stapeln som pågår och stapeln hoppar isär i vågräta remsor. Med ljusspärren på, med **A** eller med minskade rörelser står allt det still. På startskärmen och i biblioteket speglas staplarna suddigt i ett blankt golv; under passet står de i stället ända nere vid skärmens kant. Skalan går till lite över passets högsta procent (8 % över, uppåt till jämna 5), så att de högsta staplarna fyller bilden. Till vänster står procent av FTP, i zonens färg, och till höger **Borgskalan** (upplevd ansträngning, 6 till 20, i Borgtavlans färger från ljusblått till mörkrött) på samma höjd som procenten den motsvarar: ungefär 9 vid 55 %, 12 vid 75 %, 14 vid 90 %, 16 vid 105 %, 18 vid 120 % och 20 vid 150 %.

Pulsen blinkar högst 2,5 gånger per sekund. **Ljusspärren** i överblicken, under mikrofonpanelen, gör dessutom att 3D-bilden aldrig blir ljusare än en femtedel av helvitt i snitt och bara ljusnar långsamt. Den är avstängd från början, och valet sparas. Slås den på mitt i ett pass tonar bilden ned och sedan upp igen. Den dämpar också effekten efter en intervall. Är någon i salen ljuskänslig: slå på ljusspärren, eller tryck **A**, gärna redan i överblicken före start. Då står bara en stilla mörk bakgrund kvar, och effekten efter en intervall uteblir (ordet visas ändå). I överblicken står det **Animationer: av**. Valet sparas tills du trycker A igen.

Saknar datorn stöd för 3D-grafik (WebGL), eller tappas den mitt i passet, fortsätter skärmen som vanligt utan animationer.

För utveckling finns två lägen i adressen:

- `?scen=N` visar bara scen N (från 1), till exempel `http://localhost:5173/?scen=1#/run/exempel-vo2max`. Scenerna är 1 tunneln, 2 rutnätet, 3 partikelsvärmen, 4 ringen, 5 klotet, 6 flocken och 7 kalejdoskopet, och viloscenerna 8 discokulan, 9 rymdfärden, 10 lavalampan, 11 rutnätet som andas, 12 geometrin och 13 partikelmolnet.
- `?ljus=1` visar en mätruta nere till vänster med bildens medelljus, största stigningen under 400 ms, bilder per sekund och kvalitetsnivå.

## Prova takten i salen

Ta med det här till salen och bocka av:

- [ ] Datorn i salen har nät, och passen går att öppna. Följvyn på mobilen följer med när passet startar och pausas.
- [ ] Kontrollera först att mikrofonen hör musiken. Sätt igång musiken på vanlig volym, klicka **Starta** vid ett pass i biblioteket och klicka **Slå på mikrofonen**. Det ska stå **Mikrofon**, och nivåmätaren ska röra sig med musiken. Står det Intern takt hör mikrofonen ingenting, och då säger lampan inget om takten.
- [ ] Titta på lampan. Följer den bastrumman? De första sekunderna av en låt kan den komma en aning efter; när det står slag per minut efter källan ska den vara i takt.
- [ ] Ställ in Synk: står det slag per minut och pulsen ändå känns sen eller tidig, dra reglaget tills pulsen på storskärmen slår samtidigt som trumman. Anteckna värdet.
- [ ] Prova känsligheten: dra reglaget uppåt och nedåt och se var lampan följer trumman utan extra blink.
- [ ] Missar lampan slag: höj basbandets övre gräns, till exempel från 150 till 200 eller 250 Hz, och tryck Enter. Laptopens mikrofon hör ofta den djupaste basen dåligt.
- [ ] Prova medan instruktören pratar. Blinkar lampan på rösten i stället för på trumman?
- [ ] Anteckna vilken musik det fungerade med och vilken det inte fungerade med, och vilka värden för känslighet, basband och synk som var bäst.
- [ ] Animationerna bländar inte, inte heller i intervallerna med salen släckt. Gör de det: slå på ljusspärren.
- [ ] Klockorna går att läsa från den bakersta cykeln medan animationen går.
- [ ] A stänger av animationerna, och i överblicken står det **Animationer: av**.
- [ ] Effekten efter ett hårt block bländar inte, och nedräkningens siffror går att läsa framför animationen.
- [ ] Vila och paus ser lagom dämpade ut: lugna, men inte avstängda.
- [ ] Inget i bilden ser ut att flimra i takt med musiken utöver pulserna, till exempel staplar och berg som ändrar storlek med basen.

## Licens

Koden får användas, ändras och spridas enligt GNU General Public License version 3 (GPL-3.0), se filen `LICENSE`. Appen innehåller ljudbiblioteket aubio (via paketet `aubiojs`), som också har GPL-licens.

Triathlon Västs logga och bilderna i mappen `public` (`triathlon-vast.webp`, `sim-cykel-lop.png` och `favicon.png`) tillhör Triathlon Väst och ingår inte i licensen.
