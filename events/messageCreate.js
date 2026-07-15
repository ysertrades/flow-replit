const { Events } = require('discord.js');
const { readJson, writeJson } = require('../utils/jsonStorage');
const { createServerEmbed } = require('../utils/embedBuilder');

const cooldowns = new Map();

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;
        const guildId = message.guild?.id;
        if (!guildId) return;
        await handleLeveling(message);
        await handleAutoReply(message);
    },
};

async function handleLeveling(message) {
    const levels = readJson('levels.json', {});
    const guildData = levels[message.guild.id] || { users: {}, roles: {}, settings: { xpPerMessage: [15, 25], baseXp: 100, multiplier: 1.5 } };
    const userId = message.author.id;

    if (!guildData.users[userId]) {
        guildData.users[userId] = { xp: 0, level: 1, messages: 0, lastMessage: 0, totalXp: 0 };
    }

    const now = Date.now();
    const cooldownMs = 20000; // 20 second cooldown
    if (now - guildData.users[userId].lastMessage < cooldownMs) return;

    guildData.users[userId].lastMessage = now;
    guildData.users[userId].messages += 1;

    // Random XP between configured range
    const settings = guildData.settings || { xpPerMessage: [15, 25], baseXp: 100, multiplier: 1.5 };
    const minXp = settings.xpPerMessage[0] || 15;
    const maxXp = settings.xpPerMessage[1] || 25;
    const xpGain = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;
    guildData.users[userId].xp += xpGain;
    guildData.users[userId].totalXp += xpGain;

    // Calculate needed XP for next level
    const baseXp = settings.baseXp || 100;
    const multiplier = settings.multiplier || 1.5;
    const neededXp = Math.floor(baseXp * Math.pow(guildData.users[userId].level, multiplier));

    if (guildData.users[userId].xp >= neededXp) {
        guildData.users[userId].level += 1;
        guildData.users[userId].xp = 0;

        // Check for level roles
        const levelRoles = guildData.roles || {};
        const roleId = levelRoles[guildData.users[userId].level];
        if (roleId) {
            const role = message.guild.roles.cache.get(roleId);
            if (role) {
                try { await message.member.roles.add(role); } catch {}
            }
        }

        // Send level up message
        try {
            const embed = createServerEmbed('success', {
                title: 'Level Up!',
                description: `${message.author} reached **Level ${guildData.users[userId].level}**!`,
                fields: [
                    { name: 'Total XP', value: `${guildData.users[userId].totalXp}`, inline: true },
                    { name: 'Messages', value: `${guildData.users[userId].messages}`, inline: true },
                ],
            }, message.guild);
            await message.channel.send({ embeds: [embed] });
        } catch {}
    }

    levels[message.guild.id] = guildData;
    writeJson('levels.json', levels);
}

async function handleAutoReply(message) {
    const autoreplies = readJson('autoreplies.json', {});
    const guildReplies = autoreplies[message.guild.id] || {};

    for (const [name, data] of Object.entries(guildReplies)) {
        if (!data.enabled) continue;
        const content = message.content;
        let match = false;
        if (data.exact) {
            match = content.toLowerCase() === data.trigger.toLowerCase();
        } else {
            match = content.toLowerCase().includes(data.trigger.toLowerCase());
        }
        if (!match) continue;

        const key = `${message.guild.id}-${name}`;
        const lastUsed = cooldowns.get(key) || 0;
        const cooldownMs = (data.cooldown || 5) * 1000;
        if (Date.now() - lastUsed < cooldownMs) continue;

        cooldowns.set(key, Date.now());
        const embeds = readJson('embeds.json', {});
        const template = embeds[message.guild.id]?.[data.embedName];
        if (!template) continue;

        const embed = createServerEmbed('info', {
            title: template.title,
            description: template.description,
            color: template.color,
            footer: template.footer,
            thumbnail: template.thumbnail,
            image: template.image,
            fields: template.fields,
        }, message.guild);

        try { await message.reply({ embeds: [embed] }); } catch {}
        break;
    }
}
