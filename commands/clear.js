const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clears a specified number of messages from the channel.')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('The number of messages to clear.')
        .setRequired(true)
    ),

  async execute(interaction) {
    const adminFile = config.User.VerifiedDeveloper;
    const adminUsers = JSON.parse(adminFile);

    const isUserAdmin = adminUsers.includes(interaction.user.id);

    if (!isUserAdmin) {
      await interaction.reply('You do not have permission to use this command.');
      return;
    }

    const amount = interaction.options.getInteger('amount');

    if (amount <= 0 || amount > 100) {
      await interaction.reply('Please provide a valid number of messages to clear (1-100).');
      return;
    }

    try {
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      const filteredMessages = messages.filter(message => {
        const daysOld = (Date.now() - message.createdTimestamp) / (1000 * 60 * 60 * 24);
        return daysOld < 14;
      });

      if (filteredMessages.size === 0) {
        await interaction.reply('There are no messages to clear within the last 14 days.');
        return;
      }

      await interaction.channel.bulkDelete(filteredMessages);
      await interaction.reply(`Successfully cleared ${filteredMessages.size} messages.`);
    } catch (error) {
      console.error('Failed to clear messages:', error);
      await interaction.reply('Failed to clear messages. An error occurred.');
    }
  },
};
