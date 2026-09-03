# Järnpaktens vidunderbot

## Gradlogik

Botten använder samma dynamiska regel för alla aktiva vidunder:

1. Läs klanens högsta grundgrad (`current_level`/grunddelen av `display_level`).
2. Läs vidundrets `clan_boss_min_level` och `clan_boss_max_level`.
3. Aktuell toppgrad = det lägsta av klanens högsta grad och vidundrets maxgrad.
4. Aktuell bottengrad = toppgraden minus 5, men aldrig lägre än vidundrets mingrad.
5. Endast spelare inom det aktuella spannet kontrolleras mot attempts de senaste 24 timmarna.

Exempel för Bergatroll 20–40:
- Högsta klangrad G42 -> G35–40 kontrolleras. G42 räknas inte som deltagare.
- Högsta klangrad G40 -> G35–40 kontrolleras.
- Högsta klangrad G35 -> G30–35 kontrolleras.
- Högsta klangrad G23 -> G20–23 kontrolleras.

Bonusgrader som `45+15` räknas som grundgrad 45. Regeln gäller automatiskt för alla aktiva vidunder eftersom min/max hämtas från Lanistas API.

## Railway

Skapa/uppdatera Railway-servicen och ange variablerna:

- `DISCORD_TOKEN` – bot-token.
- `VIDUNDER_CHANNEL_ID` – Discord-kanalen där rapporten ska postas.
- `UPDATE_SECRET` – valfri lång hemlig text.

## Bokmärket

1. Öppna `bookmarklet-generator.html`.
2. Fyll i Railway-adress och samma `UPDATE_SECRET`.
3. Lägg till `Gladiatornamn=Discord-ID` för riktiga personpingar.
4. Klicka **Skapa bokmärkeskod** och kopiera hela koden.
5. Skapa ett bokmärke i Edge och klistra in koden som bokmärkets URL.
6. Kör bokmärket medan du är inloggad på `lanista.se`.

Bokmärket hämtar klanmedlemmar, alla aktiva vidunder och attempts för varje aktivt vidunder. Botten kontrollerar attacker under de senaste 24 timmarna. Tidigare rapport från botten raderas och ersätts med en ny rapport.

## Discord-behörigheter

Botten behöver View Channel, Send Messages och Read Message History.
