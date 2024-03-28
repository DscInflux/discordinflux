const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays all the available commands.'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Available Commands')
      .setDescription('Here is a list of all the available commands:')
      .setThumbnail(`https://discordinflux.xyz/assets/brands/image_k7x0vs.png`)
      .addFields(
        { name: '/userinfo', value: `Shows the user info on DiscordInlux.`, inline: true },
        { name: 'Coming Soon', value: `Come back to see more commands.`, inline: true },
      );

    try {
      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(`Could not send help response to the channel.\n`, error);
      await interaction.reply('There was an error while executing the command. Please try again later.');
    }
  },
};
