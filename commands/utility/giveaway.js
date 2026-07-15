const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { colors } = require('../../utils/embedBuilder');

const giveawayTimers = new Map();

function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match) return null;
    return parseInt(match[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway').setDescription('Start a giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('prize').setDescription('Prize').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 1h, 30m, 1d)').setRequired(true))
        .addIntegerOption(opt => opt.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(10).setRequired(false))
        .addStringOption(opt => opt.setName('image').setDescription('Image URL for the giveaway embed').setRequired(false)),
    async execute(interaction) {
        const prize = interaction.options.getString('prize');
        const durationStr = interaction.options.getString('duration');
        const winners = interaction.options.getInteger('winners') || 1;
        const imageUrl = interaction.options.getString('image');
        const ms = parseDuration(durationStr);
        if (!ms) {
            return interaction.reply({ embeds: [{ color: colors.error, title: 'Invalid Duration', description: 'Use format like `1h`, `30m`, `1d`.' }], ephemeral: true });
        }

        const endTime = Date.now() + ms;
        const endTimestamp = Math.floor(endTime / 1000);

        const embed = new EmbedBuilder()
            .setColor(colors.giveaway)
            .setTitle('GIVEAWAY')
            .setDescription(`**Prize:** ${prize}`)
            .addFields(
                { name: 'Ends', value: `<t:${endTimestamp}:R>`, inline: true },
                { name: 'Winners', value: `${winners}`, inline: true },
                { name: 'Entries', value: '**0** participants', inline: true },
                { name: 'Hosted By', value: `<@${interaction.user.id}>`, inline: false },
            )
            .setFooter({ text: 'Click the button below to enter!' })
            .setTimestamp();

        if (imageUrl) embed.setImage(imageUrl);
        embed.setThumbnail(interaction.guild.iconURL({ dynamic: true }) || interaction.user.displayAvatarURL());

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('giveaway_enter')
                .setLabel('Enter')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎟️')
        );

        const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        if (!global.giveawayEntrants) global.giveawayEntrants = new Map();
        global.giveawayEntrants.set(msg.id, new Set());

        if (giveawayTimers.has(msg.id)) {
            clearTimeout(giveawayTimers.get(msg.id));
        }

        const timer = setTimeout(async () => {
            await endGiveaway(msg, prize, winners, imageUrl, interaction.user.id);
        }, ms);
        giveawayTimers.set(msg.id, timer);
    },
};

async function endGiveaway(message, prize, winnersCount, imageUrl, hostId) {
    if (!global.giveawayEntrants) global.giveawayEntrants = new Map();
    const entrants = global.giveawayEntrants.get(message.id);

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('giveaway_ended')
            .setLabel('Ended')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
            .setEmoji('🎉')
    );

    if (!entrants || entrants.size === 0) {
        const noWinnersEmbed = new EmbedBuilder()
            .setColor(colors.error)
            .setTitle('GIVEAWAY ENDED')
            .setDescription(`**Prize:** ${prize}\n\nNo participants entered.`)
            .setFooter({ text: 'Better luck next time!' })
            .setTimestamp();
        if (imageUrl) noWinnersEmbed.setImage(imageUrl);
        await message.edit({ embeds: [noWinnersEmbed], components: [disabledRow] });
        global.giveawayEntrants.delete(message.id);
        giveawayTimers.delete(message.id);
        return;
    }

    // Fisher-Yates shuffle: `.sort(() => Math.random() - 0.5)` looks random but
    // is biased (comparator-based sorts don't handle inconsistent comparators
    // fairly), so some entrants would end up statistically more likely to win.
    // This gives every entrant an equal chance.
    const shuffled = Array.from(entrants);
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const winnerIds = shuffled.slice(0, winnersCount);
    const winnerMentions = winnerIds.map(id => `<@${id}>`).join(', ');

    const winnerEmbed = new EmbedBuilder()
        .setColor(colors.success)
        .setTitle('GIVEAWAY ENDED')
        .setDescription(`**Prize:** ${prize}`)
        .addFields(
            { name: 'Winner(s)', value: winnerMentions },
            { name: 'Total Entries', value: `${entrants.size}`, inline: true },
            { name: 'Hosted By', value: `<@${hostId}>`, inline: true },
        )
        .setFooter({ text: 'Congratulations!' })
        .setTimestamp();
    if (imageUrl) winnerEmbed.setImage(imageUrl);

    await message.edit({ embeds: [winnerEmbed], components: [disabledRow] });
    await message.reply({ content: `Congratulations ${winnerMentions}! You won **${prize}**!\nDM <@${hostId}> to claim your prize.` });
    global.giveawayEntrants.delete(message.id);
    giveawayTimers.delete(message.id);
}
