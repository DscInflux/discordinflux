const fs = require('fs');
const User = require('../models/user');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ButtonBuilder, ChannelType, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeuser')
    .setDescription('Remove a user from the database')
    .addStringOption(option =>
      option.setName('user_id')
        .setDescription('The Discord ID or mention of the user')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason for user removal')
        .setRequired(true))
    .setDefaultPermission(true)
    .setDMPermission(false),
  async execute(interaction) {
    // Check if the user is an admin
    const adminFile = config.User.AdminUser;
    const isUserAdmin = adminUsers.includes(interaction.user.id);

    if (!isUserAdmin) {
      await interaction.reply('You do not have permission to use this command.');
      return;
    }

    // Get the user ID and reason from the interaction options
    const userIdOrMention = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason');

    // Extract the user ID from the mention
    const userIdMatch = userIdOrMention.match(/\d+/);
    const userId = userIdMatch ? userIdMatch[0] : null;

    // Find the user in the database
    const user = await User.findOne({ discordId: userId }).exec();

    if (!user) {
      await interaction.reply(`User with ID ${userId} not found.`);
      return;
    }

    // Create the embed
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setTitle('User Removal Confirmation')
      .setDescription(`Are you sure you want to remove the user ${user.username} (${userIdOrMention}) from the database?\n\nReason: ${reason}`);

    // Mention the user in the embed
    const mentionedUser = interaction.guild.members.cache.get(userId);
    if (mentionedUser) {
      embed.setDescription(`Are you sure you want to remove the user ${mentionedUser} (${userIdOrMention}) from the database?\n\nReason: ${reason}`);
    }

    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm')
      .setLabel('Yes')
      .setStyle(ButtonStyle.Danger);

    const denyButton = new ButtonBuilder()
      .setCustomId('deny')
      .setLabel('No')
      .setStyle(ButtonStyle.Secondary);

    // Create the action row with the buttons
    const actionRow = new ActionRowBuilder().addComponents(confirmButton, denyButton);

    // Reply with the embed and buttons
    const reply = await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });

    // Collect the button interactions
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

    collector.on('collect', async i => {
      try {
        if (i.customId === 'confirm') {
          await reply.edit({ components: [] });

          // Check if the user is still in the database
          const removedUser = await User.findOne({ discordId: userId }).exec();
          if (!removedUser) {
            await interaction.followUp('User has already been removed.');
            return;
          }

          // Remove the user from the database
          await User.deleteOne({ discordId: userId }).exec();

          // Send the reason to a text channel
          const channelId = '1110009498359312444'; // Replace with the correct channel ID
          const channel = interaction.guild.channels.cache.get(channelId);
          if (channel && channel.type === ChannelType.GuildText) {
            await channel.send(`User ${mentionedUser || userIdOrMention} has been removed.\n\nReason: ${reason}`);
          }

          await interaction.followUp(`User ${mentionedUser || userIdOrMention} has been successfully removed from the database.`);
        } else if (i.customId === 'deny') {
          await reply.edit({ components: [] });
          await interaction.followUp('User removal canceled.');
        }
      } catch (error) {
        console.error(error);
        await interaction.followUp('An error occurred while processing the command.');
      }
    });

    collector.on('end', async () => {
      if (!reply.deleted) {
        await reply.edit({ components: [] });
      }
    });
  },
};
