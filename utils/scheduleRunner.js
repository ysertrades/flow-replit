const { readJson, writeJson } = require('./jsonStorage');
const { computeNextRun } = require('./scheduler');

const CHECK_INTERVAL_MS = 20000;

// Starts the background loop that fires due schedules. Safe to call once
// after the client is ready (needs client.guilds.cache populated).
function startScheduleRunner(client) {
    const tick = () => checkSchedules(client).catch(err => console.error('[SCHEDULE RUNNER ERROR]', err));
    tick(); // catch up on anything due immediately (e.g. bot was offline)
    setInterval(tick, CHECK_INTERVAL_MS);
}

async function checkSchedules(client) {
    const schedules = readJson('schedules.json', {});
    const now = Date.now();
    let changed = false;

    for (const guildId of Object.keys(schedules)) {
        const guildSchedules = schedules[guildId];
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue; // bot no longer in this guild; leave data as-is

        for (const id of Object.keys(guildSchedules)) {
            const schedule = guildSchedules[id];
            if (schedule.time > now) continue;

            changed = true;
            const result = await fireSchedule(guild, schedule).catch(err => {
                console.error(`[SCHEDULE ${id}] failed to send:`, err);
                return { ok: false, reason: 'send-error' };
            });

            if (!result.ok) {
                console.warn(`[SCHEDULE ${id}] removed (${result.reason}) — guild ${guildId}`);
                delete guildSchedules[id];
                continue;
            }

            const next = computeNextRun(schedule.time, schedule.frequency, now, schedule.offsetMinutes || 0);
            if (next) {
                schedule.time = next;
                schedule.lastRun = now;
            } else {
                delete guildSchedules[id];
            }
        }
    }

    if (changed) writeJson('schedules.json', schedules);
}

async function fireSchedule(guild, schedule) {
    const channel = guild.channels.cache.get(schedule.channelId);
    if (!channel || !channel.isTextBased()) {
        return { ok: false, reason: 'channel-missing' };
    }

    // Required lazily to avoid a require cycle at module-load time.
    const { buildEmbedPayload } = require('../commands/utility/embed');
    const payload = buildEmbedPayload(guild, schedule.embedName);
    if (!payload) {
        return { ok: false, reason: 'template-missing' };
    }

    let content;
    if (schedule.mention === '@everyone') content = '@everyone';
    else if (schedule.mention === '@here') content = '@here';
    else if (schedule.mention && /^\d+$/.test(schedule.mention)) content = `<@&${schedule.mention}>`;

    await channel.send({ content, embeds: [payload.embed], components: payload.components.length > 0 ? payload.components : undefined });
    return { ok: true };
}

module.exports = { startScheduleRunner };
