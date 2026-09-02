# Järnpaktens vidunderbot

## Railway

Skapa en ny Railway-service och lägg in filerna. Ange variablerna:

- `DISCORD_TOKEN` – bot-token.
- `VIDUNDER_CHANNEL_ID` – Discord-kanalen där rapporten ska postas.
- `UPDATE_SECRET` – valfri lång hemlig text.

Skapa därefter en publik Railway-domän.

## Bokmärket

1. Öppna `bookmarklet-generator.html`.
2. Fyll i Railway-adress och samma `UPDATE_SECRET`.
3. Välj om gränsen ska vara 10 eller 5 grader under vidundrets maxgrad.
4. Lägg till `Gladiatornamn=Discord-ID` för riktiga personpingar.
5. Klicka **Skapa bokmärkeskod** och kopiera hela koden.
6. Skapa ett bokmärke i Edge och klistra in koden som bokmärkets URL.
7. Kör bokmärket medan du är inloggad på `lanista.se`.

Botten kontrollerar endast attacker under de senaste 24 timmarna. Bonusgrader som `45+15` räknas som grundgrad 45. För Drakdrottningen kontrolleras endast grad 40–maxgraden. Tidigare rapport från botten raderas och ersätts med ett nytt meddelande.

## Discord-behörigheter

Botten behöver View Channel, Send Messages och Read Message History.
