# Järnpaktens vidunderbot v2.1

## Gradlogik
För alla aktiva vidunder används samma regel:
- klanens högsta grundgrad hämtas från `current_level`
- toppgrad = min(klanens högsta grad, vidundrets `clan_boss_max_level`)
- bottengrad = max(vidundrets `clan_boss_min_level`, toppgrad - 5)
- bara spelare inom det spannet kontrolleras mot attempts senaste 24 timmarna

Exempel Bergatroll 20–40:
- klanhögsta G42 -> G35–40
- klanhögsta G40 -> G35–40
- klanhögsta G35 -> G30–35
- klanhögsta G23 -> G20–23

## v2.1-fix
- Vidundrets min/max läses från active-data, med fallback mot `/api/clans/bosses/available` via npc_enemy.id.
- Om en attempts-request misslyckas fortsätter resten av rapporten ändå.
- Bokmärket läser nu riktigt svar från Railway och visar exakt HTTP/feltext istället för att dölja serverfel med no-cors.
- Servern har CORS för lanista.se.
- Discord-postning loggas tydligare i Railway.

## Railway-variabler
Behåll samma variabler:
- `DISCORD_TOKEN`
- `VIDUNDER_CHANNEL_ID`
- `UPDATE_SECRET`

## Efter GitHub-uppladdning
Skapa en NY bokmärkeskod från den nya `bookmarklet-generator.html`. Det gamla bokmärket innehåller den gamla JavaScript-koden och uppdateras inte automatiskt.

Discordbotten behöver View Channel, Send Messages och Read Message History.
