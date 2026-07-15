// events/interactionCreate.js
const { InteractionType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const { readJson } = require('../utils/jsonStorage');
const embedUtil = { error: (title, description) => createEmbed('error', { title, description }) };

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    console.log(`[INTERACTION] type=${interaction.type} isCommand=${interaction.isChatInputCommand()} name=${interaction.commandName || interaction.customId} guild=${interaction.guildId} at=${new Date().toISOString()}`);
    // ── Slash Commands ───────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`[INTERACTION] no command handler registered for "${interaction.commandName}"`);
        return;
      }

      // Enforce per-command role allowlists set via /config perm
      if (interaction.inGuild()) {
        const config = readJson('config.json', {});
        const allowedRoleIds = config[interaction.guild.id]?.commandPermissions?.[interaction.commandName];
        if (allowedRoleIds && allowedRoleIds.length > 0) {
          const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
          const hasAllowedRole = allowedRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
          if (!isAdmin && !hasAllowedRole) {
            return interaction.reply({
              embeds: [embedUtil.error('No Permission', `You need one of the allowed roles to use \`/${interaction.commandName}\`.`)],
              ephemeral: true,
            }).catch(() => {});
          }
        }
      }

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[CMD ERROR] /${interaction.commandName}:`, err);
        const errEmbed = embedUtil.error('Error', 'An unexpected error occurred. Please try again.');
        const reply = { embeds: [errEmbed], ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }

    // ── Button Interactions ──────────────────────────────
    if (interaction.isButton()) {
      // Check for giveaway button specifically
      if (interaction.customId === 'giveaway_enter') {
        if (!global.giveawayEntrants) global.giveawayEntrants = new Map();
        const entrants = global.giveawayEntrants.get(interaction.message.id);
        
        if (!entrants) {
          return interaction.reply({ content: 'This giveaway has ended or was not found.', ephemeral: true });
        }
        
        if (entrants.has(interaction.user.id)) {
          return interaction.reply({ content: 'You\'ve already entered this giveaway!', ephemeral: true });
        }
        
        entrants.add(interaction.user.id);

        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
        const fields = updatedEmbed.data.fields || [];
        const entriesFieldIndex = fields.findIndex(f => f.name === 'Entries');
        const entriesField = { name: 'Entries', value: `**${entrants.size}** participants`, inline: true };
        if (entriesFieldIndex >= 0) {
          fields[entriesFieldIndex] = entriesField;
        } else {
          fields.push(entriesField);
        }
        updatedEmbed.setFields(fields);
        await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});

        return interaction.reply({ content: 'You\'ve entered the giveaway! Good luck! 🎉', ephemeral: true });
      }

      try {
        // Ticket panel buttons (create_ticket / close_ticket)
        if (interaction.customId === 'create_ticket' || interaction.customId === 'close_ticket') {
          await client.commands.get('ticket')?.handleButton(interaction, [], client);
        } else if (interaction.customId.startsWith('poll_vote_')) {
          await client.commands.get('poll')?.handleButton(interaction, [], client);
        } else if (interaction.customId.startsWith('embed_edit_')) {
          await client.commands.get('embed')?.handleEmbedButton(interaction);
        } else {
          const [system, ...args] = interaction.customId.split(':');
          const handler = client.commands.get(`btn_${system}`);
          if (handler?.handleButton) {
            await handler.handleButton(interaction, args, client);
          }
        }
      } catch (err) {
        console.error(`[BTN ERROR] ${interaction.customId}:`, err);
        const errEmbed = embedUtil.error('Error', 'An unexpected error occurred.');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        }
      }
    }

    // ── Modal Submissions (embed template editor) ────────
    if (interaction.isModalSubmit()) {
      try {
        if (interaction.customId.startsWith('embed_modal_')) {
          await client.commands.get('embed')?.handleEmbedModal(interaction);
        }
      } catch (err) {
        console.error(`[MODAL ERROR] ${interaction.customId}:`, err);
        const errEmbed = embedUtil.error('Error', 'An unexpected error occurred.');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        }
      }
    }

    // ── Select Menu Interactions ─────────────────────────
    if (interaction.isStringSelectMenu()) {
      const [system, ...args] = interaction.customId.split(':');
      const handler = client.commands.get(`sel_${system}`);
      if (handler?.handleSelect) {
        try {
          await handler.handleSelect(interaction, args, client);
        } catch (err) {
          console.error(`[SEL ERROR] ${interaction.customId}:`, err);
          const errEmbed = embedUtil.error('Error', 'An unexpected error occurred.');
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
          } else {
            await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
          }
        }
      }
    }
  },
};
