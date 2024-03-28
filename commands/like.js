// like.js file
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

const createBetaEmbed = require('../discordbot/beta.js');
const filename = 'like';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('like')
    .setDescription('Give a like to a user from Discordinflux')
    .addStringOption(option =>
      option.setName('discord_id')
        .setDescription('The Discord ID of the user')
        .setRequired(true))
    .setDefaultPermission(true)
    .setDMPermission(false),
  beta: true,
  async execute(interaction) {
    if (this.beta) {
      const betaEmbed = createBetaEmbed(filename, interaction);
      await interaction.reply({ embeds: [betaEmbed] });
    } else {
      await interaction.reply(`test`);
    }
  },
};
