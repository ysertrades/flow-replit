const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge').setDescription('Delete messages')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub => sub.setName('amount').setDescription('Delete recent messages')
            .addIntegerOption(opt => opt.setName('number').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true)))
        .addSubcommand(sub => sub.setName('user').setDescription('Delete messages from user')
            .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
            .addIntegerOption(opt => opt.setName('number').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true))),
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const channel = interaction.channel;

        if (sub === 'amount') {
            const amount = interaction.options.getInteger('number');
            const statusEmbed = createServerEmbed('info', { title: '🧹 Clearing...', description: `Deleting **${amount}** messages.` }, interaction.guild);
            const statusMsg = await interaction.reply({ embeds: [statusEmbed], fetchReply: true });

            try {
                const fetched = await channel.messages.fetch({ limit: amount + 1 });
                const toDelete = fetched.filter(m => m.id !== statusMsg.id && Date.now() - m.createdTimestamp < 1209600000);
                await channel.bulkDelete(toDelete, true);
                const successEmbed = createServerEmbed('success', { title: '✅ Cleared', description: `Deleted **${toDelete.size}** messages.` }, interaction.guild);
                await interaction.editReply({ embeds: [successEmbed] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            } catch {
                const errEmbed = createServerEmbed('error', { title: '❌ Error', description: 'Failed. Messages older than 14 days cannot be bulk deleted.' }, interaction.guild);
                await interaction.editReply({ embeds: [errEmbed] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
            }
        } else if (sub === 'user') {
            const user = interaction.options.getUser('user');
            const amount = interaction.options.getInteger('number');
            const statusEmbed = createServerEmbed('info', { title: '🧹 Clearing...', description: `Deleting up to **${amount}** messages from **${user.tag}**.` }, interaction.guild);
            const statusMsg = await interaction.reply({ embeds: [statusEmbed], fetchReply: true });

            try {
                let deleted = 0, lastId = null;
                const cutoff = Date.now() - 1209600000;
                while (deleted < amount) {
                    const opts = { limit: 100 };
                    if (lastId) opts.before = lastId;
                    const fetched = await channel.messages.fetch(opts);
                    if (fetched.size === 0) break;
                    const userMsgs = fetched.filter(m => m.author.id === user.id && m.id !== statusMsg.id && m.createdTimestamp > cutoff);
                    if (userMsgs.size === 0) { lastId = fetched.last().id; continue; }
                    const toDelete = userMsgs.first(Math.min(amount - deleted, userMsgs.size));
                    await channel.bulkDelete(toDelete, true);
                    deleted += toDelete.length;
                    lastId = fetched.last().id;
                }
                const successEmbed = createServerEmbed('success', { title: '✅ Cleared', description: `Deleted **${deleted}** messages from **${user.tag}**.` }, interaction.guild);
                await interaction.editReply({ embeds: [successEmbed] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
            } catch {
                const errEmbed = createServerEmbed('error', { title: '❌ Error', description: 'Failed to delete messages.' }, interaction.guild);
                await interaction.editReply({ embeds: [errEmbed] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
            }
        }
    },
};
