const { SlashCommandBuilder } = require('discord.js');
const { createServerEmbed } = require('../../utils/embedBuilder');
const { readJson } = require('../../utils/jsonStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance').setDescription('Check your balance')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const economy = readJson('economy.json', {});
        const guildData = economy[interaction.guild.id] || {};
        const userData = guildData[user.id] || { balance: 0 };

        const embed = createServerEmbed('info', {
            title: 'Balance',
            description: `<@${user.id}>`,
            fields: [
                { name: 'Wallet', value: `**${userData.balance}** coins`, inline: true },
            ],
            thumbnail: user.displayAvatarURL(),
        }, interaction.guild);
        await interaction.reply({ embeds: [embed] });
    },
};
