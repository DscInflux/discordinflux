const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

const betaEmbed = require('../discordbot/beta.js');

module.exports = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('lookup the user info from discordinflux')
    .addStringOption(option =>
      option.setName('user')
        .setDescription('The Discord user to look up')
        .setRequired(true)),
  beta: true,

  async execute(interaction) {
    const userMention = interaction.options.getString('user');
    const discordIdMatch = userMention.match(/^<@!?(\d+)>$/);
    const discordId = discordIdMatch ? discordIdMatch[1] : userMention;
    const url = `https://discordinflux.xyz/user/${discordId}/info`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          likeCount: 5,
          viewCount: 10,
        }),
      });

      // Check if the response status is 404
      if (response.status === 404) {
       await interaction.reply({ content: 'We could not find that user. Please try another user!', ephemeral: true });
        return;
      }

      const data = await response.json();

      const components = [];

      if (data.github) {
        const githubButton = new ButtonBuilder()
          .setLabel('Github')
          .setStyle(ButtonStyle.Link)
          .setEmoji("<:github:1105032515804205078>")
          .setURL(`${data.github}`);

        components.push(githubButton);
      }

      const userprofile = new ButtonBuilder()
        .setLabel('Profile')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discordinflux.xyz/user/${discordId}`);

      components.push(userprofile);

      const actionRow = new ActionRowBuilder()
        .addComponents(components);

      const embed = new EmbedBuilder()
        .setTitle(`${data.username}'s Info`)
        .setDescription(data.bio ? data.bio : "This user hasn't added a description.")
        .setThumbnail(`${data.avatarUrl}`)
        .setImage(`${data.bannerimage}`)
        .addFields(
          { name: 'View count', value: `${data.viewCount}`, inline: true },
          { name: 'Like count', value: `${data.likeCount}`, inline: true },
        );

      await interaction.reply({ embeds: [embed], components: [actionRow] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'An error occurred while retrieving user info.', ephemeral: true });
    }
  },
};
