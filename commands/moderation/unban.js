const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban').setDescription('Unban a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(opt => opt.setName('userid').setDescription('User ID').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false)),
    async execute(interaction) {
        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('reason') || 'No reason';
        try {
            await interaction.guild.members.unban(userId, reason);
            await interaction.reply({ embeds: [createServerEmbed('success', { title: '🔓 Unbanned', description: `User ID **${userId}** unbanned.`, fields: [{ name: 'Reason', value: reason }] }, interaction.guild)] });
        } catch {
            await interaction.reply({ embeds: [createServerEmbed('error', { title: 'Error', description: 'Failed to unban. Check the ID.' }, interaction.guild)], ephemeral: true });
        }
    },
};
