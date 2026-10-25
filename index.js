const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const VIDUNDER_CHANNEL_ID = process.env.VIDUNDER_CHANNEL_ID;
const UPDATE_SECRET = process.env.UPDATE_SECRET;
const PORT = process.env.PORT || 3000;

if (!DISCORD_TOKEN || !VIDUNDER_CHANNEL_ID || !UPDATE_SECRET) {
  console.error("DISCORD_TOKEN, VIDUNDER_CHANNEL_ID och UPDATE_SECRET måste finnas.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const app = express();
app.use(express.text({ type: "*/*", limit: "500kb" }));

// Tillåt bokmärket på lanista.se att läsa svaret så fel inte döljs.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === "https://lanista.se" || origin === "https://www.lanista.se") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/", (req, res) => res.send("Järnpaktens vidunderbot är online."));
app.get("/health", (req, res) => res.json({ ok: true, discordReady: client.isReady() }));

function baseLevel(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("sv-SE");
}

function stockholmTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "okänd tid";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).format(date);
}

function nameWithoutClanSuffix(value) {
  return String(value || "").replace(/\s+Järnsvuren\s*$/iu, "").trim();
}

function mentionFor(member, mentionMap) {
  const profile = normalizeName(member.profileName);
  const profileId = mentionMap[profile] || Object.entries(mentionMap).find(([key]) => normalizeName(key) === profile)?.[1];
  if (profileId && /^\d{15,22}$/.test(String(profileId))) return `<@${profileId}>`;
  const fullName = String(member.name || "").trim();
  const baseName = nameWithoutClanSuffix(fullName);

  // Föredra exakt namn om det finns, men fall tillbaka till namnet utan
  // klansuffixet "Järnsvuren". Spelare utan suffix påverkas inte.
  const id =
    mentionMap[fullName] ||
    mentionMap[normalizeName(fullName)] ||
    mentionMap[baseName] ||
    mentionMap[normalizeName(baseName)];

  return id && /^\d{15,22}$/.test(String(id)) ? `<@${id}>` : `**${member.name}**`;
}

function splitMessage(lines, limit = 1850) {
  const chunks = [];
  let current = "";
  for (const line of lines) {
    if ((current + "\n" + line).length > limit && current) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildReport(payload) {
  const now = new Date(payload.generatedAt || Date.now());
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const mentionMap = payload.mentionMap || {};
  const members = (Array.isArray(payload.members) ? payload.members : [])
    .map(member => ({ name: String(member.name || "").slice(0, 80), level: baseLevel(member.level), profileName: String(member.profileName || "").slice(0, 80) }))
    .filter(member => member.name && member.level > 0);

  const lines = ["🐉 **JÄRNPAKTEN – AKTIVA VIDUNDER**", ""];
  const bosses = Array.isArray(payload.bosses) ? payload.bosses : [];

  if (!bosses.length) {
    lines.push("_Inga aktiva vidunder just nu._");
  }

  for (const boss of bosses) {
    const name = String(boss.name || "Okänt vidunder").slice(0, 100);
    const min = baseLevel(boss.minLevel);
    const max = baseLevel(boss.maxLevel);
    const attempts = Array.isArray(boss.attempts) ? boss.attempts : [];

    if (!min || !max) {
      lines.push(`⚠️ **${name}** · kunde inte läsa vidundrets gradintervall.`);
      lines.push("");
      continue;
    }

    // Välj de 12 högsta spelarna inom vidundrets riktiga gradintervall.
    // Drakdrottningen har dessutom specialregeln grad 40+.
    const isDragonQueen = normalizeName(name).includes("drakdrottning");
    const effectiveMin = isDragonQueen ? Math.max(min, 40) : min;

    const recentAttempts = attempts.filter(attempt => {
      const timestamp = new Date(attempt.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now.getTime() + 60000;
    });
    const attackedNames = new Set(recentAttempts.map(attempt => normalizeName(attempt.name)));

    const eligible = members
      .filter(member => member.level >= effectiveMin && member.level <= max)
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "sv"))
      .slice(0, 12);

    const missing = eligible.filter(member => !attackedNames.has(normalizeName(member.name)));
    const attacked = eligible.filter(member => attackedNames.has(normalizeName(member.name)));

    lines.push(`⚔️ **${name}** · grad ${min}–${max} · ${boss.health || "okänd hälsa"}`);
    if (!eligible.length) {
      lines.push(`_Ingen i klanen är behörig inom grad ${effectiveMin}–${max}. Retirerar ${stockholmTime(boss.resetsAt)}._`);
    } else {
      lines.push(`_Utvalda: klanens ${eligible.length} högsta inom grad ${effectiveMin}–${max}${isDragonQueen ? " (Drakdrottningen: endast G40+)" : ""}. Retirerar ${stockholmTime(boss.resetsAt)}._`);
    }
    lines.push(missing.length
      ? `🚨 **Har inte slagit senaste 24 h (${missing.length}):** ${missing.map(member => `${mentionFor(member, mentionMap)} (${member.level})`).join(", ")}`
      : "✅ **Alla behöriga har slagit senaste 24 h.**");
    lines.push(attacked.length
      ? `✅ **Har slagit (${attacked.length}):** ${attacked.map(member => `${member.name} (${member.level})`).join(", ")}`
      : "⚪ **Har slagit:** Ingen behörig ännu.");
    if (boss.attemptError) lines.push(`⚠️ _Attempts kunde inte hämtas: ${boss.attemptError}_`);
    lines.push("");
  }

  lines.push(`_Uppdaterad ${stockholmTime(now)} · 24-timmarskontroll_`);
  return splitMessage(lines).map((chunk, index) => index === 0
    ? chunk
    : `🐉 **JÄRNPAKTEN – AKTIVA VIDUNDER (forts.)**\n${chunk}`);
}

async function replaceReport(channel, chunks) {
  const recent = await channel.messages.fetch({ limit: 100 });
  const old = recent.filter(message =>
    message.author.id === client.user.id &&
    message.content.startsWith("🐉 **JÄRNPAKTEN – AKTIVA VIDUNDER")
  );

  for (const message of old.values()) {
    await message.delete().catch(error => console.warn("Kunde inte radera gammal rapport:", error.message));
  }

  for (const content of chunks) {
    const users = [...new Set([...content.matchAll(/<@(\d+)>/g)].map(m => m[1]))].slice(0, 100);
    await channel.send({ content, allowedMentions: { parse: [], users } });
  }
}

app.post("/update", async (req, res) => {
  try {
    let payload;
    try { payload = JSON.parse(req.body || "{}"); }
    catch { return res.status(400).send("Ogiltig JSON"); }

    if (payload.secret !== UPDATE_SECRET) return res.status(403).send("Fel UPDATE_SECRET");
    if (!client.isReady()) return res.status(503).send("Discord är inte redo ännu");

    const channel = await client.channels.fetch(VIDUNDER_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return res.status(500).send("Fel VIDUNDER_CHANNEL_ID eller kanalen är inte textbaserad");

    const chunks = buildReport(payload);
    await replaceReport(channel, chunks);
    console.log(`Rapport postad: ${payload.bosses?.length || 0} vidunder, ${payload.members?.length || 0} medlemmar, ${chunks.length} Discord-meddelande(n).`);
    res.send("OK");
  } catch (error) {
    console.error("UPDATE FEL:", error);
    res.status(500).send(`Internt fel: ${error.message || error}`);
  }
});

client.once("ready", () => console.log(`Discord: inloggad som ${client.user.tag}`));
client.login(DISCORD_TOKEN).catch(error => console.error("Discord login-fel:", error));
app.listen(PORT, "0.0.0.0", () => console.log(`HTTP-server lyssnar på port ${PORT}`));
