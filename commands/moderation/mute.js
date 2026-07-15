const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute').setDescription('Timeout a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('e.g. 10m, 1h, 1d').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const durationStr = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'No reason';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'User not found.' }, interaction.guild)], ephemeral: true });

        const ms = parseDuration(durationStr);
        if (!ms || ms > 28 * 24 * 60 * 60 * 1000) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'Invalid duration. Max 28 days.' }, interaction.guild)], ephemeral: true });

        await member.timeout(ms, reason);
        const cases = readJson('cases.json', {});
        const guildCases = cases[interaction.guild.id] || [];
        const caseId = guildCases.length + 1;
        guildCases.push({ id: caseId, type: 'mute', userId: user.id, userTag: user.tag, moderatorId: interaction.user.id, moderatorTag: interaction.user.tag, reason, duration: durationStr, timestamp: Date.now() });
        cases[interaction.guild.id] = guildCases;
        writeJson('cases.json', cases);

        await interaction.reply({ embeds: [createServerEmbed('success', { title: '🔇 Timed Out', description: `**${user.tag}** timed out for **${durationStr}**.`, fields: [{ name: 'Reason', value: reason }, { name: 'Case', value: `#${caseId}` }] }, interaction.guild)] });
    },
};

function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return val * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
}
