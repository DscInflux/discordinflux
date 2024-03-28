const fs = require('fs');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimrole')
    .setDescription('Claim a role'),
  async execute(interaction) {
    // Get the user's ID
    const userId = interaction.user.id;

    // Check if the user is a trusted user or an admin
    const adminList = config.User.AdminUser;
    const verifiedUsers = config.User.VerifiedUser;
    const isAdmin = adminUsers.includes(userId);
    const isTrustedUser = verifiedUsers.includes(userId);

    // Check if the user is a trusted user or an admin
    if (!isTrustedUser && !isAdmin) {
      // If not a trusted user or admin, delete the loading embed and reply with a message
      const notAllowedEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('You are not a trusted user or an admin. You cannot claim any role.');
      await interaction.reply({ embeds: [notAllowedEmbed] });
      return;
    }

    // Determine the role ID based on the user's status
    let roleId = null;
    if (isTrustedUser) {
      roleId = '1100886327995666442';
    } else if (isAdmin) {
      roleId = '1101447315522334722';
    }

    // Check if a valid role ID was found
    if (!roleId) {
      // If no valid role ID found, delete the loading embed and reply with a message
      await interaction.channel.messages.delete(interaction.id);
      const notEligibleEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('You are not eligible to claim a role.');
      await interaction.reply({ embeds: [notEligibleEmbed] });
      return;
    }

    // Add the role to the user
    const guild = interaction.guild;
    const member = await guild.members.fetch(userId);

    // Check if the user already has the role
    if (member.roles.cache.has(roleId)) {
      // If the user already has the role, delete the loading embed and reply with a message
      const alreadyAddedEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('You already have the role.');
      await interaction.reply({ embeds: [alreadyAddedEmbed] });
      return;
    }

    // Add the role to the user
    try {
      await member.roles.add(roleId);
      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setDescription(`✅ Role successfully added: ${roleId}`)
        .setFooter({ text: 'Role added' });
      await interaction.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error(error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ An error occurred while adding the role. Please try again later.')
        .setFooter({ text: 'Role addition failed' });
      await interaction.reply({ embeds: [errorEmbed] });
    }
  },
};
