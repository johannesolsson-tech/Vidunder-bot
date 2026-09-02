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

function mentionFor(member, mentionMap) {
  const id = mentionMap[member.name] || mentionMap[normalizeName(member.name)];
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
  const behind = Math.min(10, Math.max(5, Number(payload.maxLevelsBehind) || 10));
  const members = (Array.isArray(payload.members) ? payload.members : [])
    .map(member => ({ name: String(member.name || "").slice(0, 80), level: baseLevel(member.level) }))
    .filter(member => member.name && member.level > 0);

  const lines = ["🐉 **JÄRNPAKTEN – AKTIVA VIDUNDER**", ""];
  const bosses = Array.isArray(payload.bosses) ? payload.bosses : [];
  if (!bosses.length) lines.push("_Inga aktiva vidunder just nu._");

  for (const boss of bosses) {
    const name = String(boss.name || "Okänt vidunder").slice(0, 100);
    const min = baseLevel(boss.minLevel);
    const max = baseLevel(boss.maxLevel);
    const isDragonQueen = normalizeName(name).includes("drakdrottning");
    const threshold = isDragonQueen ? 40 : Math.max(min, max - behind);
    const attempts = Array.isArray(boss.attempts) ? boss.attempts : [];
    const recentAttempts = attempts.filter(attempt => {
      const timestamp = new Date(attempt.createdAt).getTime();
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now.getTime() + 60000;
    });
    const attackedNames = new Set(recentAttempts.map(attempt => normalizeName(attempt.name)));
    const eligible = members
      .filter(member => member.level >= threshold && member.level <= max)
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "sv"));
    const missing = eligible.filter(member => !attackedNames.has(normalizeName(member.name)));
    const attacked = eligible.filter(member => attackedNames.has(normalizeName(member.name)));

    lines.push(`⚔️ **${name}** · grad ${min}–${max} · ${boss.health || "okänd hälsa"}`);
    lines.push(`_Kontrollerar grad ${threshold}–${max}${isDragonQueen ? " (Drakdrottningen: endast 40+)" : ""}. Retirerar ${stockholmTime(boss.resetsAt)}._`);
    lines.push(missing.length
      ? `🚨 **Har inte slagit senaste 24 h (${missing.length}):** ${missing.map(member => `${mentionFor(member, mentionMap)} (${member.level})`).join(", ")}`
      : "✅ **Alla behöriga har slagit senaste 24 h.**");
    lines.push(attacked.length
      ? `✅ **Har slagit (${attacked.length}):** ${attacked.map(member => `${member.name} (${member.level})`).join(", ")}`
      : "⚪ **Har slagit:** Ingen behörig ännu.");
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
  for (const message of old.values()) await message.delete();
  for (const content of chunks) {
    await channel.send({ content, allowedMentions: { parse: [], users: [...content.matchAll(/<@(\d+)>/g)].map(m => m[1]) } });
  }
}

app.post("/update", async (req, res) => {
  try {
    let payload;
    try { payload = JSON.parse(req.body || "{}"); }
    catch { return res.status(400).send("Ogiltig JSON"); }
    if (payload.secret !== UPDATE_SECRET) return res.status(403).send("Fel secret");
    if (!client.isReady()) return res.status(503).send("Discord är inte redo");
    const channel = await client.channels.fetch(VIDUNDER_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return res.status(500).send("Fel kanal-ID");
    await replaceReport(channel, buildReport(payload));
    res.send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internt fel");
  }
});

client.once("ready", () => console.log(`Discord: inloggad som ${client.user.tag}`));
client.login(DISCORD_TOKEN);
app.listen(PORT, "0.0.0.0", () => console.log(`HTTP-server lyssnar på port ${PORT}`));
