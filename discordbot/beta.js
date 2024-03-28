const { EmbedBuilder } = require('discord.js');

function createBetaEmbed(filename) {
  const betaEmbed = new EmbedBuilder()
    .setTitle('🚧 Beta Feature')
    .setDescription(`Sorry, the **${filename}** feature is currently in beta testing.`)
    .setColor('#FFD700');

  console.log(betaEmbed.description); // make sure filename is correctly interpolated
  return betaEmbed;
}


module.exports = createBetaEmbed;
