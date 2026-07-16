const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addCoins, checkCooldown, setCooldown } = require('../../utils/economyManager');

const WORK_COOLDOWN = 60 * 60 * 1000;
const MIN_EARNINGS = 50;
const MAX_EARNINGS = 200;

const jobs = [
  { emoji: '💻', text: 'coded a bot' },
  { emoji: '🍕', text: 'delivered pizzas' },
  { emoji: '📚', text: 'tutored students' },
  { emoji: '🎨', text: 'created artwork' },
  { emoji: '🎵', text: 'performed music' },
  { emoji: '⚡', text: 'fixed electrical issues' },
  { emoji: '🧑‍💼', text: 'worked at an office' },
  { emoji: '🏗️', text: 'did construction work' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work and earn coins (1 hour cooldown)'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const cooldownTime = checkCooldown(userId, 'work', WORK_COOLDOWN);

    if (cooldownTime > 0) {
      const hours = Math.floor(cooldownTime / 3600000);
      const minutes = Math.floor((cooldownTime % 3600000) / 60000);
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('⏰ Still on Cooldown')
        .setDescription('You need to wait **' + hours + 'h ' + minutes + 'm** before you can work again.')
        .setFooter({ text: 'Work again later!' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const earnings = Math.floor(Math.random() * (MAX_EARNINGS - MIN_EARNINGS + 1)) + MIN_EARNINGS;
    const randomJob = jobs[Math.floor(Math.random() * jobs.length)];

    addCoins(userId, earnings);
    setCooldown(userId, 'work');

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Work Completed!')
      .setDescription(randomJob.emoji + ' You ' + randomJob.text + ' and earned **' + earnings + '** coins!')
      .setFooter({ text: 'Come back in 1 hour for more work' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
