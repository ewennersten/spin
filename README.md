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

Säger terminalen att port 5173 redan används är appen redan igång i ett annat terminalfönster. Använd det fönstret, eller stäng det först.

## Starta alltid på samma sätt

De sparade passen ligger i webbläsaren och är knutna till adressen `http://localhost:5173`. Starta därför alltid appen med `npm run dev` och öppna den i samma webbläsare. Med en annan adress, en annan port eller en annan webbläsare ser det ut som att passen är borta. Samma sak gäller tillståndet för mikrofonen.

## Säkerhetskopiera passen

Klicka på **Exportera pass** i biblioteket. Då hamnar en fil som heter `spinningpass-` följt av datumet i mappen Hämtade filer. Spara filen någon annanstans också, till exempel i molnet.

Med **Importera pass** läser du in en sådan fil igen. Passen i filen läggs till, och inget av de pass som redan finns skrivs över.

Exporten innehåller passen. Peppord och mikrofonens inställningar följer inte med.

## Locket ska vara öppet

Ha laptopens lock öppet under hela passet. En MacBook stänger av mikrofonen när locket fälls ned, och då går appen över till intern takt.

## Tangenterna

| Tangent | Gör |
|---------|-----|
| Mellanslag | I överblicken: startar passet. Under passet: pausar och fortsätter. |
| Pil höger | Hoppar till nästa block. I sista blocket går passet till slut. |
| Pil vänster | Går tillbaka till början av blocket. Under blockets första tre sekunder: till föregående block. |
| Pil upp, pil ned | Under passet: höjer eller sänker mikrofonens känslighet ett steg. Värdet sparas. |
| F | Fullskärm av och på. |
| M | Under passet: mikrofonen av och på. Av betyder att den interna takten används. |
| Q | Avsluta passet. Enter avslutar, valfri annan tangent fortsätter. |

Esc lämnar fullskärm men avslutar inte passet.

Laddas sidan om mitt i passet fortsätter klockan där den var. Tryck F för att få fullskärm igen.

## Mikrofonen

Före start visar överblicken en liten panel för mikrofonen:

- **Slå på mikrofonen** öppnar mikrofonen. Första gången frågar webbläsaren om lov.
- **Nivå** visar hur mycket mikrofonen hör.
- **Lampan** blinkar på varje slag som appen hittar.
- **Mikrofon** eller **Intern takt** visar vilket läge som gäller just nu.
- **Känslighet** (1 till 10): högre ger fler slag, lägre ger färre.
- **Basband** är de frekvenser där appen letar efter bastrumman, från 20 till 500 Hz. Från början 40 till 150 Hz.

Ändringarna sparas direkt och finns kvar nästa gång.

När du har klickat i panelen går tangenterna till panelen och inte till passet. Klicka någonstans utanför panelen innan du startar passet med mellanslag.

Under passet visar en liten ruta nere till höger läget och en prick som blinkar på slagen.

Appen går över till **intern takt** (130 slag per minut) när mikrofonen är avstängd, inte är tillåten eller har varit tyst i mer än fem sekunder. När ljudet kommer tillbaka gäller mikrofonen igen. Klockorna påverkas aldrig av ljudet.

Har mikrofonen nekats en gång frågar webbläsaren inte igen. Klicka då på symbolen till vänster om adressen, tillåt mikrofonen och ladda om sidan.

Har du redan tillåtit mikrofonen startar den vid första tangenttryckningen eller klicket, även efter en omladdning mitt i passet.

## Prova takten i salen

Ta med det här till salen och bocka av:

- [ ] Sätt igång musiken på vanlig volym, öppna ett pass och klicka **Slå på mikrofonen**.
- [ ] Titta på lampan. Följer den bastrumman? Den kan komma en aning efter trumman, det är väntat.
- [ ] Prova känsligheten: dra reglaget uppåt och nedåt och se var lampan följer trumman utan extra blink.
- [ ] Missar lampan slag: höj basbandets övre gräns, till exempel från 150 till 200 eller 250 Hz. Laptopens mikrofon hör ofta den djupaste basen dåligt.
- [ ] Prova medan instruktören pratar. Blinkar lampan på rösten i stället för på trumman?
- [ ] Anteckna vilken musik det fungerade med och vilken det inte fungerade med, och vilka värden för känslighet och basband som var bäst.
