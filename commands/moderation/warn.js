const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson, writeJson } = require('../../utils/jsonStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn').setDescription('Warn a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'User not found.' }, interaction.guild)], ephemeral: true });
        if (member.roles.highest.position >= interaction.member.roles.highest.position) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'Cannot warn this user.' }, interaction.guild)], ephemeral: true });

        const cases = readJson('cases.json', {});
        const guildCases = cases[interaction.guild.id] || [];
        const caseId = guildCases.length + 1;
        guildCases.push({ id: caseId, type: 'warn', userId: user.id, userTag: user.tag, moderatorId: interaction.user.id, moderatorTag: interaction.user.tag, reason, timestamp: Date.now() });
        cases[interaction.guild.id] = guildCases;
        writeJson('cases.json', cases);

        await interaction.reply({ embeds: [createServerEmbed('success', { title: '⚠️ Warned', description: `**${user.tag}** warned.`, fields: [{ name: 'Reason', value: reason }, { name: 'Case', value: `#${caseId}` }] }, interaction.guild)] });
    },
};
