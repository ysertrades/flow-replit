const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readJson } = require('../../utils/jsonStorage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory').setDescription('Check your inventory')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const economy = readJson('economy.json', {});
        const guildData = economy[interaction.guild.id] || {};
        const userData = guildData[user.id] || { balance: 0, inventory: [] };
        const items = userData.inventory || [];

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setAuthor({ name: `${user.tag}'s Inventory`, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(items.length === 0 ? '*Your inventory is empty. Buy items from the shop!*' : `You have **${items.length}** item(s) in your inventory.`)
            .addFields(
                items.length > 0
                    ? items.map((item, i) => ({
                        name: `${i + 1}. ${item.emoji} ${item.name}`,
                        value: `${item.description}
*Bought <t:${Math.floor(item.boughtAt / 1000)}:R>*`,
                        inline: false,
                    }))
                    : []
            )
            .addFields({ name: 'Balance', value: `**${userData.balance}** coins`, inline: false })
            .setFooter({ text: `${interaction.guild.name} • YSER Flow`, iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
