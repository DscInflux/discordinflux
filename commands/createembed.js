const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createembed')
    .setDescription('Creates and sends an embed.')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to send the embed to.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('The title of the embed.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('The description of the embed.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('thumbnail')
        .setDescription('The URL of the thumbnail image for the embed.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('image')
        .setDescription('The URL of the main image for the embed.')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('inline')
        .setDescription('Whether the fields should be displayed inline.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('field1name')
        .setDescription('The name of field 1.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('field1value')
        .setDescription('The value of field 1.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('field2name')
        .setDescription('The name of field 2.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('field2value')
        .setDescription('The value of field 2.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('button1label')
        .setDescription('The label of button 1.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('button1link')
        .setDescription('The link URL of button 1.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('button2label')
        .setDescription('The label of button 2.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('button2link')
        .setDescription('The link URL of button 2.')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const thumbnailUrl = interaction.options.getString('thumbnail');
    const imageUrl = interaction.options.getString('image');
    const inline = interaction.options.getBoolean('inline');
    const field1Name = interaction.options.getString('field1name');
    const field1Value = interaction.options.getString('field1value');
    const field2Name = interaction.options.getString('field2name');
    const field2Value = interaction.options.getString('field2value');
    const button1Label = interaction.options.getString('button1label');
    const button1Link = interaction.options.getString('button1link');
    const button2Label = interaction.options.getString('button2label');
    const button2Link = interaction.options.getString('button2link');

    if (!channel) {
      await interaction.reply('Error: You need to choose a channel to send the embed to.');
      return;
    }

    try {
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description);

      if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
      }

      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      if (field1Name && field1Value) {
        embed.addFields({ name: field1Name, value: field1Value, inline });
      }

      if (field2Name && field2Value) {
        embed.addFields({ name: field2Name, value: field2Value, inline });
      }

      // Create buttons with label and link
      const buttons = [];

      if (button1Label && button1Link) {
        const button1 = new ButtonBuilder()
          .setLabel(button1Label)
          .setStyle(ButtonStyle.Link)
          .setURL(button1Link);

        buttons.push(button1);
      }

      if (button2Label && button2Link) {
        const button2 = new ButtonBuilder()
          .setLabel(button2Label)
          .setStyle(ButtonStyle.Link)
          .setURL(button2Link);

        buttons.push(button2);
      }

      // Create action row with buttons
      const actionRow = new ActionRowBuilder().addComponents(...buttons);

      await channel.send({ embeds: [embed], components: [actionRow] });

      await interaction.reply('Embed sent successfully to the channel!');
    } catch (error) {
      console.error('Failed to send embed:', error);
      await interaction.reply('Failed to send embed. An error occurred.');
    }
  },
};