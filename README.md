# Spinningskärm

Appen visar spinningpasset på storskärmen i salen: vad ni kör nu, hur länge till och vad som kommer sedan. Den lyssnar också på musiken genom laptopens mikrofon och letar efter takten i basen.

Använd Chrome eller Edge.

## Starta appen

Node.js måste finnas på datorn. Saknas det: hämta LTS-versionen från nodejs.org och installera den.

1. Öppna programmet Terminal.
2. Skriv `cd` och ett mellanslag, dra mappen *Spinning spel* från Finder in i terminalfönstret och tryck Enter.
3. Första gången, och bara då, kör du:

   ```
   npm install
   ```

4. Starta appen:

   ```
   npm run dev
   ```

5. Öppna `http://localhost:5173/` i Chrome eller Edge.

Låt terminalfönstret vara öppet så länge appen används. Du stänger appen genom att trycka Ctrl+C i terminalen.

Säger terminalen att port 5173 är upptagen ("Port 5173 is already in use") betyder det att något annat program använder porten. Det kan vara den här appen i ett annat terminalfönster, eller ett helt annat program. Öppna `http://localhost:5173/` och se efter vad som visas innan du stänger något: är det den här appen kan du använda den direkt.

## Starta alltid på samma sätt

De sparade passen ligger i webbläsaren och är knutna till adressen `http://localhost:5173`. Starta därför alltid appen med `npm run dev` och öppna den i samma webbläsare. Med en annan adress, en annan port eller en annan webbläsare ser det ut som att passen är borta. Samma sak gäller tillståndet för mikrofonen.

## Säkerhetskopiera passen

Klicka på **Exportera pass** i biblioteket. Då hamnar en fil som heter `spinningpass-` följt av datumet i mappen Hämtade filer. Spara filen någon annanstans också, till exempel i molnet.

Med **Importera pass** läser du in en sådan fil igen. Passen i filen läggs till, och inget av de pass som redan finns skrivs över.

Exporten innehåller passen. Peppord och mikrofonens inställningar följer inte med.

## Locket ska vara öppet

Ha laptopens lock öppet under hela passet. En MacBook stänger av mikrofonen när locket fälls ned, och då går appen över till intern takt. Har locket ändå fällts ned och det står Intern takt fast musiken spelar: ladda om sidan, se "Om mikrofonen försvinner" nedan.

## Tangenterna

| Tangent | Gör |
|---------|-----|
| Mellanslag | I överblicken: startar passet, även när reglaget eller ett talfält i mikrofonpanelen har fokus. Under passet: pausar och fortsätter. Står fokus på en knapp trycker mellanslag på knappen. |
| Pil höger | Hoppar till nästa block. I sista blocket gör den ingenting. |
| Pil vänster | Går tillbaka till början av blocket. Under blockets första tre sekunder: till föregående block. |
| Pil upp, pil ned | Under passet: höjer eller sänker mikrofonens känslighet ett steg. Värdet sparas. |
| F | Fullskärm av och på. |
| A | I överblicken och under passet: stänger av och sätter på animationerna. Överblicken visar valet under "Mellanslag startar passet", så att du kan stänga av före start. Valet sparas, till skillnad från M, och gäller även efter en omladdning och nästa pass. Saknar datorn stöd för 3D-grafik gör A ingenting. |
| M | Under passet: växlar mellan mikrofonen och den interna takten. Mikrofonen är fortfarande öppen, så webbläsarens mikrofonsymbol lyser kvar. Valet sparas inte: efter en omladdning används mikrofonen igen. |
| Q | I överblicken: tillbaka till biblioteket, som länken **Till biblioteket** (använd länken om du just har rört mikrofonpanelen). Under passet: avsluta passet. Enter avslutar, valfri annan tangent fortsätter. |

Esc lämnar fullskärm men avslutar inte passet.

Laddas sidan om mitt i passet fortsätter klockan där den var. Tryck F för att få fullskärm igen.

Ett pass som lämnades utan Q, till exempel med bakåtknappen eller en stängd flik, återupptas när du trycker **Starta** vid samma pass igen inom fyra timmar, om passets tid inte redan har gått ut. Klockan har gått under tiden: lämnade du passet vid 20:00 och kommer tillbaka fem minuter senare visar skärmen 25:00. Bara ett pausat pass står kvar där det var. Vill du börja om från början: avsluta passet med Q och Enter, och tryck **Starta** igen.

## Mikrofonen

Klicka på **Starta** vid ett pass i biblioteket. Överblicken som då visas, före start, har en liten panel för mikrofonen. Panelen finns inte i **Redigera**.

- **Slå på mikrofonen** öppnar mikrofonen. Första gången frågar webbläsaren om lov.
- **Nivå** visar hur mycket mikrofonen hör.
- **Lampan** blinkar på varje slag som mikrofonen hittar. I läget Intern takt är den släckt.
- **Mikrofon** eller **Intern takt** visar vilket läge som gäller just nu. Står det Intern takt används inte mikrofonen.
- **Känslighet** (1 till 10): högre ger fler slag, lägre ger färre.
- **Basband** är de frekvenser där appen letar efter bastrumman, från 20 till 500 Hz. Från början 40 till 150 Hz.

Reglaget sparas direkt. Ett talfält gäller och sparas först när du trycker Enter eller Tab, klickar utanför fältet eller startar passet med mellanslag. Inställningarna finns kvar nästa gång.

Mellanslag startar passet även när reglaget eller ett talfält har fokus. Pilarna går till reglaget eller talfältet så länge det har fokus.

Under passet visar en liten ruta nere till höger läget. En fylld prick blinkar på slagen från mikrofonen, och en tom ring blinkar i den interna takten.

Appen går över till **intern takt** (130 slag per minut) när mikrofonen är avstängd, inte är tillåten eller har varit tyst i mer än fem sekunder. När ljudet kommer tillbaka efter tystnad gäller mikrofonen igen. Klockorna påverkas aldrig av ljudet.

Har du redan tillåtit mikrofonen startar den vid första tangenttryckningen eller klicket, även efter en omladdning mitt i passet.

### Om mikrofonen inte är tillåten

Har mikrofonen nekats en gång frågar webbläsaren inte igen. Klicka då på symbolen till vänster om adressen, tillåt mikrofonen och ladda om sidan.

Samma meddelande visas om macOS inte tillåter webbläsaren att använda mikrofonen. Öppna då Systeminställningar, Integritet och säkerhet, Mikrofon, och slå på Chrome (eller Edge). Starta om webbläsaren om den ber om det.

### Om mikrofonen försvinner

Om mikrofonen försvinner mitt i passet, till exempel för att locket har fällts ned eller en mikrofon har kopplats ur, går appen över till intern takt. Håll därför locket öppet under passet. Står det Intern takt fast musiken spelar: ladda om sidan. Klockan fortsätter där den var, och mikrofonen startar vid första tangenttryckningen.

## Animationerna

Under passet fyller en 3D-animation bakgrunden. Den blir vildare ju högre procent av FTP ni kör, är lugn i vilan och under paus, och pulserar i takt med musiken (eller den interna takten). Vid nya block byts scenen, högst var 20:e sekund, och bytet tonar genom mörker. Klockorna och texterna ligger på mörka plattor, så att de går att läsa framför animationen. I överblicken och efter passet är bakgrunden mörk.

Ljuset är begränsat: bilden blir aldrig ljusare än en femtedel av helvitt i snitt, ljusnar bara långsamt och blinkar högst 2,5 gånger per sekund. Är någon i salen ljuskänslig: tryck **A**. Då står bara en stilla mörk bakgrund kvar, och rutan nere till höger visar **Animationer av**. Valet sparas tills du trycker A igen.

Saknar datorn stöd för 3D-grafik (WebGL), eller tappas den mitt i passet, fortsätter skärmen som vanligt utan animationer.

För utveckling finns två lägen i adressen:

- `?scen=N` visar bara scen N (från 1), till exempel `http://localhost:5173/?scen=1#/run/exempel-vo2max`.
- `?ljus=1` visar en mätruta nere till vänster med bildens medelljus, största stigningen under 400 ms, bilder per sekund och kvalitetsnivå.

## Prova takten i salen

Ta med det här till salen och bocka av:

- [ ] Kontrollera först att mikrofonen hör musiken. Sätt igång musiken på vanlig volym, klicka **Starta** vid ett pass i biblioteket och klicka **Slå på mikrofonen**. Det ska stå **Mikrofon**, och nivåmätaren ska röra sig med musiken. Står det Intern takt hör mikrofonen ingenting, och då säger lampan inget om takten.
- [ ] Titta på lampan. Följer den bastrumman? Den kan komma en aning efter trumman, det är väntat.
- [ ] Prova känsligheten: dra reglaget uppåt och nedåt och se var lampan följer trumman utan extra blink.
- [ ] Missar lampan slag: höj basbandets övre gräns, till exempel från 150 till 200 eller 250 Hz, och tryck Enter. Laptopens mikrofon hör ofta den djupaste basen dåligt.
- [ ] Prova medan instruktören pratar. Blinkar lampan på rösten i stället för på trumman?
- [ ] Anteckna vilken musik det fungerade med och vilken det inte fungerade med, och vilka värden för känslighet och basband som var bäst.
- [ ] Animationerna bländar inte, inte heller i intervallerna med salen släckt.
- [ ] Klockorna går att läsa från den bakersta cykeln medan animationen går.
- [ ] A stänger av animationerna, och det står **Animationer av** nere till höger.
