const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute').setDescription('Remove timeout')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason';
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'User not found.' }, interaction.guild)], ephemeral: true });

        await member.timeout(null, reason);
        await interaction.reply({ embeds: [createServerEmbed('success', { title: '🔊 Unmuted', description: `**${user.tag}** timeout removed.`, fields: [{ name: 'Reason', value: reason }] }, interaction.guild)] });
    },
};
