const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const DiscordStrategy = require("passport-discord").Strategy;
const User = require("./models/user");
const ensureAuthenticated = require("./models/ensureAuthenticated");
const path = require("path");
const minifyHTML = require("express-minify-html");
const Partner = require("./models/partner"); // or wherever your Partner model is defined
const flash = require("connect-flash");
const cron = require("node-cron");
const request = require("request");
const config = require("./config.js")
const fetch = require("./fetch/fetch.d.ts");
const Discord = require("discord.js");

const {
  REST,
  Routes,
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const sanitizeHtml = require("sanitize-html");
const fs = require("fs");
const userList = config.user.VerifiedUser;
const verifiedpartners = config.user.Verifiedpartners;

// ...

const showdown = require("showdown"); // Import the showdown library

const converter = new showdown.Converter(); // Create a new showdown converter instance
const app = express();
const crypto = require("crypto");

const generateSecret = () => {
  return crypto.randomBytes(32).toString("hex");
};

console.log(generateSecret());
// configure environment variables
require("dotenv").config();
const recaptcha = require("express-recaptcha");
// configure passport for user authentication using Discord OAuth

const commands = [];
const commandFiles = fs
  .readdirSync("./commands")
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data);
}

client.commands = new Collection();

for (const command of commands) {
  client.commands.set(command.name, require(`./commands/${command.name}.js`));
}

const token = process.env.token;
const clientId = config.client.clientID;
const guildId = config.server.guildID;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setPresence({
    activities: [
      {
        name: `Everyone`,
        type: ActivityType.Streaming,
        url: "https://www.twitch.tv/kaicenat",
      },
    ],
    status: "online",
  });
});

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

passport.use(
  new DiscordStrategy(
    {
      clientID: config.client.clientID,
      clientSecret: config.client.secret,
      callbackURL: config.website.callbackURL,
      scope: ["identify"],
    },
    (accessToken, refreshToken, profile, done) => {
      const { id, username, discriminator, avatar, banner } = profile;
      const tag = `${username}#${discriminator}`;
      const avatarUrl = `https://cdn.discordapp.com/avatars/${id}/${avatar}.png`;
      const bannerUrl = banner
        ? `https://cdn.discordapp.com/banners/${id}/${banner}.png`
        : null;

      // update the user's profile in the database
      User.findOneAndUpdate(
        { discordId: id },
        {
          $set: {
            username,
            discriminator,
            tag,
            avatarUrl,
            bannerUrl,
          },
        },
        { new: true } // return the updated document
      )
        .exec()
        .then((user) => {
          // if the user doesn't exist, create a new user in the database
          if (!user) {
            const newUser = new User({
              discordId: id,
              username,
              discriminator,
              tag,
              avatarUrl,
              bannerUrl,
            });
            return newUser.save();
          }
          return user;
        })
        .then((user) => {
          done(null, user);
        })
        .catch((err) => {
          console.error(err);
          done(err);
        });
    }
  )
);

// configure passport to serialize and deserialize users
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .exec()
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      console.error(err);
      done(err);
    });
});

// connect to the MongoDB database
mongoose
  .connect(config.database.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error(err);
  });

// configure express middleware
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: config.website.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.set("views", path.join(__dirname, "views/web"));
app.set("view engine", "ejs");
app.use("/node_modules", express.static(path.join(__dirname, "/node_modules")));
app.use(
  minifyHTML({
    override: true,
    exception_url: false,
    htmlMinifier: {
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeEmptyAttributes: true,
      minifyJS: true,
    },
  })
);

app.use((req, res, next) => {
  const contentType = res.get("Content-Type");

  if (contentType === "text/css" || contentType === "application/javascript") {
    import("minify")
      .then(({ default: minify }) => {
        minify(req.url)
          .then((minified) => {
            res.set("Content-Length", minified.length);
            res.send(minified);
          })
          .catch(next);
      })
      .catch(next);
  } else {
    next();
  }
});

// Schedule the resetLikes function to run every Monday at 12:00 AM
cron.schedule("0 0 * * 1", resetLikes);

async function resetLikes() {
  try {
    // Set the likeCount field to 0 for all users in the database
    await User.updateMany({}, { likeCount: 0 });
    console.log("Like counts reset successfully");
  } catch (error) {
    console.error(error);
  }
}

function checkMobileDevice(req, res, next) {
  // Block requests from Cloudflare apps
  if (req.headers["CF-App-Installed"] === "true") {
    res.status(403).send("Access Forbidden");
    return;
  }

  // Block mobile devices
  if (/Mobi|Android/i.test(req.headers["user-agent"])) {
    res.render("mobile/pagedisableerror");
  } else {
    next();
  }
}

app.use(checkMobileDevice);
const ejs = require("ejs");
const xml2js = require("xml2js");

const pages = [
  {
    loc: "https://discordinflux.xyz",
    lastmod: "2023-05-04",
    changefreq: "daily",
    priority: "1.0",
  },
  {
    loc: "https://discordinflux.xyz/partners",
    lastmod: "2023-05-04",
    changefreq: "weekly",
    priority: "0.8",
  },
  {
    loc: "https://discordinflux.xyz/login",
    lastmod: "2023-05-04",
    changefreq: "daily",
    priority: "0.5",
  },
  {
    loc: "https://discordinflux.xyz/user/:discordId",
    lastmod: "2023-05-04",
    changefreq: "daily",
    priority: "0.7",
  },
];

app.get("/sitemap.xml", (req, res) => {
  ejs.renderFile("views/web/others/sitemap.ejs", { pages }, (err, str) => {
    if (err) {
      console.error(err);
      return res.status(500).end();
    }

    const parser = new xml2js.Parser({ trim: true });
    parser.parseString(str, (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).end();
      }

      const builder = new xml2js.Builder({
        xmldec: { version: "1.0", encoding: "UTF-8" },
        renderOpts: { pretty: true },
        invalidCharReplacement: "",
      });

      const xml = builder.buildObject(result);
      res.set("Content-Type", "application/xml");
      res.send(xml);
    });
  });
});

const isAdmin = (req, res, next) => {
  req.isAdmin = allowedAdminIds.includes(parseInt(req.user.discordId));
  next();
};

const verifiedIds = config.user.VerifiedUser;
const adminsbadges = config.user.AdminUser;
const developerbadges = config.user.VerifiedDeveloper;

// legal only

app.get("/legal/terms", (req, res) => {
  res.render("legal/terms", { authenticated: req.user });
});

app.get("/legal/privacy", (req, res) => {
  res.render("legal/privacy", { authenticated: req.user });
});

// legal done

app.get("/", async (req, res) => {
  try {
    let users = await User.find({}).sort({ score: -1 }).exec();
    const randomIndex = Math.floor(Math.random() * users.length);
    const randomUsers = users[randomIndex];
    const searchQuery = req.query.search; // Get the search query from the request query parameters

    // Fetch all users or filtered users based on the search query
    if (searchQuery) {
      // Perform a search query if it exists
      users = await User.find({ $text: { $search: searchQuery } }).exec();
    } else {
      // Fetch all users if there is no search query
      users = await User.find({}).exec();
    }

    // shuffle the array of users
    const shuffledUsers = users.sort(() => Math.random() - 0.5);

    // filter out the removed users
    const filteredUsers = shuffledUsers.filter((user) => !user.removed);

    // create an array of verified and admin users
    const verifiedIds = ["853916655893479455", "840850487821074464"];
    const verifiedpartnerscardj = require("./config.js");
    const verifiedUsers = filteredUsers.filter((user) =>
      verifiedIds.includes(user.discordId)
    );
    const siteadminUsers = filteredUsers.filter((user) =>
      adminsbadges.includes(user.discordId)
    );

    // get the first verified user and the top 6 verified users by score
    const firstVerifiedUser = verifiedUsers.find((user) => user.score);
    const verifiedTopUsers = verifiedUsers
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    // get the number of users on discordinflux
    const numUsers = filteredUsers.length;

    // get the top 3 users by score and the 6 most recently added users for both arrays
    const topUsers = filteredUsers.slice(0, 3);
    const recentlyAdded = shuffledUsers
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6);
    const verifiedRecentlyAdded = verifiedUsers.slice(0, 6);
    const topUsersLiked = users
      .filter((user) => user.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 3);

    // render the home page with the user data
    res.render("index", {
      topUsers,
      randomUsers,
      recentlyAdded,
      numUsers,
      topUsersLiked,
      firstVerifiedUser,
      verifiedUsers,
      siteadminUsers,
      verifiedIds,
      verifiedTopUsers,
      verifiedRecentlyAdded,
      users: filteredUsers,
      verifiedpartnerscardj,
      authenticated: req.user,
      user: req.user,
      shuffledUsers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/ads.txt", (req, res) => {
  res.send("google.com, pub-9750247758090908, DIRECT, f08c47fec0942fa0");
});

app.get("/partners", async (req, res) => {
  const partners = await Partner.find({});

  res.render("partners", { authenticated: req.user, partners });
});

app.get("/admin/partners", ensureAuthenticated, isAdmin, (req, res) => {
  res.render("panel/add-partners", { authenticated: req.user });
});

app.get("/admin/partner/remove", ensureAuthenticated, isAdmin, (req, res) => {
  const error = req.query.error
    ? "An error occurred while removing the partner or Partner not found."
    : null;
  res.render("panel/remove-partners", { authenticated: req.user, error });
});

app.get("/admin/remove", ensureAuthenticated, isAdmin, (req, res) => {
  res.render("panel/remove-user.ejs", {
    authenticated: req.user,
    discordId: req.params.discordId,
  });
});

app.get(
  "/admin/remove/:discordId",
  ensureAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      // Check if the authenticated user is an admin
      if (!allowedAdminIds.includes(req.user.discordId)) {
        return res.status(401).send("Unauthorized");
      }

      // Find the user with the given Discord ID and remove their profile
      const user = await User.findOneAndRemove({
        discordId: req.params.discordId,
      });

      // Check if the user was found and removed
      if (!user) {
        return res.send(
          `User with Discord ID ${req.params.discordId} does not exist.`
        );
      }

      // Return a success message
      res.send(`User ${user.tag} has been removed.`);
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal server error");
    }
  }
);

app.post("/admin/partners/remove", async (req, res) => {
  const partnerName = req.body.partnerName;
  try {
    const removedPartner = await Partner.findOneAndDelete({
      name: partnerName,
    });
    if (removedPartner) {
      res.redirect("/partners");
    } else {
      res.redirect("/admin/partner/remove?error");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/partners/add", async (req, res) => {
  const { name, description, logoUrl, websiteUrl, banner } = req.body;

  try {
    const partner = await Partner.create({
      name,
      description,
      logoUrl,
      banner,
      websiteUrl,
    });
    res.redirect("/partners");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating partner");
  }
});

app.post("/delete-profile", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.discordId; // Convert to string
    const username = req.user.username;
    const discriminator = req.user.discriminator;
    const reason = req.body.reason;

    // Create a log entry for the deletion request
    console.log(`User ${userId} requested deletion of their profile`);

    // Delete the user's profile from MongoDB
    await User.deleteOne({ discordId: userId });

    // Redirect to homepage
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/user/:discordId", async (req, res) => {
  try {
    const user = await User.findOne({ discordId: req.params.discordId }).lean();
    if (!user) {
      return res.status(404).render("user404", { authenticated: req.user });
    }
    // some admin partners and dev things
    const adminid = config.User.AdminUser;
    const developerid = config.User.VerifiedDeveloper;
    const verifiedpartners = config.User.Verifiedpartners;
    const developer = developerid.includes(user.discordId);
    const admin = adminid.includes(user.discordId);
    const now = new Date();

    // Check if it's been at least a day since the user's profile was last viewed
    const lastViewed = user.lastViewed || new Date(0);
    const dayInMs = 24 * 60 * 60 * 1000;
    if (now - lastViewed < dayInMs) {
      // If it hasn't been a day yet, don't increment the view count
      return res.render("user", {
        user,
        authenticated: req.user,
        verified,
        monthlyViewCounts: user.monthlyViewCounts,
        admin,
        viewCount: user.viewCount,
      });
    }

    // Increment the vote count for the user
    await User.findOneAndUpdate(
      { discordId: req.params.discordId },
      { $inc: { voteCount: 1 } }
    );

    // Increment the view count for the user
    const currentMonth = now.getMonth();
    const monthlyViewCountsLength = user.monthlyViewCounts
      ? user.monthlyViewCounts.length
      : 0;
    if (currentMonth >= monthlyViewCountsLength) {
      const newCounts = Array(currentMonth + 1).fill(0);
      if (user.monthlyViewCounts) {
        user.monthlyViewCounts.forEach((count, index) => {
          newCounts[index] = count;
        });
      }
      await User.findOneAndUpdate(
        { discordId: req.params.discordId },
        {
          $inc: { viewCount: 1 },
          $set: { monthlyViewCounts: newCounts, lastViewed: now },
        }
      );
    } else if (!user.monthlyViewCounts || user.monthlyViewCounts.length < 1) {
      console.error("Monthly view counts array is undefined or too short");
      return res.status(500).send("Internal server error");
    } else {
      await User.findOneAndUpdate(
        { discordId: req.params.discordId },
        {
          $inc: { viewCount: 1 },
          $set: {
            [`monthlyViewCounts.${currentMonth}`]:
              (user.monthlyViewCounts[currentMonth] || 0) + 1,
            lastViewed: now,
          },
        }
      );
    }
    // test accounts lol
    const testaccountusers = config.User.TestUser;
    const verifiedUsers = config.User.VerifiedUser;
    // Get the verified status of the user from the verifiedusersid.json file
    const verified = verifiedUsers.includes(user.discordId);
    // Pass the verified status and view count to the user.ejs template
    res.render("user", {
      user,
      error: req.flash("error"), // pass error message(s) if any
      success: req.flash("success"), // pass success message(s) if any
      authenticated: req.user,
      testaccount,
      verified,
      developer,
      verifiedpartners,
      monthlyViewCounts: user.monthlyViewCounts,
      admin,
      messages: {
        error: req.flash("error"),
        success: req.flash("success"),
      },
      viewCount: user.viewCount + 1,
      errorMessages: req.flash("error"),
      successMessages: req.flash("success"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.post("/user/:discordId/report", ensureAuthenticated, async (req, res) => {
  try {
    // Retrieve the necessary information from the request body
    const { reason } = req.body;
    const discordId = req.params.discordId;

    // Check if the reason exceeds the character limit
    if (reason.length > 250) {
      req.flash("error", "Reason must be 250 characters or less.");
      return res.redirect(`/user/${discordId}`);
    }

    // Find the user based on the provided Discord ID
    const user = await User.findOne({ discordId }).lean();
    if (!user) {
      return res.status(404).render("user404", { authenticated: req.user });
    }

    const components = [];

    // Get the Discord channel to send the report
    const reportChannelId = config.Server.channels.reportlogs;
    const reportChannel = client.channels.cache.get(reportChannelId);

    // buttons
    const userprofile = new ButtonBuilder()
      .setLabel("Profile")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discordinflux.xyz/user/${discordId}`);
    const actionRow = new ActionRowBuilder().addComponents(userprofile);
    components.push(userprofile);
    // Construct the report embed
    const reportEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("User Report")
      .setDescription(
        `User: ${user.username}\nProfile ID: ${discordId}\nReported by: ${req.user.username} (${req.user.discordId})`
      )
      .addFields({ name: "Reason", value: `${reason}`, inline: true })
      .setTimestamp();

    // Send the report embed to the report channel
    await reportChannel.send({
      embeds: [reportEmbed],
      components: [actionRow],
    });

    // Return a success response and redirect with success flash message
    req.flash("success", "Report submitted successfully!");
    res.redirect(`/user/${discordId}`);
  } catch (error) {
    console.error(error);
    req.flash("error", "Internal server error");
    res.redirect(`/user/${discordId}`);
  }
});

//some api

app.post("/user/:discordId/info", async (req, res) => {
  try {
    const { discordId } = req.params;
    const { likeCount, viewCount, icon, avatarUrl } = req.body;

    const user = await User.findOneAndUpdate(
      { discordId },
      { $set: { likeCount, viewCount, icon, avatarUrl } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      likeCount: user.likeCount,
      bio: user.bio,
      username: user.username,
      viewCount: user.viewCount,
      github: user.github,
      website: user.website,
      avatarUrl: user.avatarUrl,
      bannerimage: user.bannerimage,
      icon: user.icon,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/user/:discordId/like", ensureAuthenticated, async (req, res) => {
  try {
    // Check if user is trying to like themselves
    if (req.user.discordId === req.params.discordId) {
      req.flash("error", "You cannot like yourself.");
      return res.redirect(`/user/${req.params.discordId}`);
    }

    const user = await User.findOne({ discordId: req.params.discordId }).lean();
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect(`/user/${req.params.discordId}`);
    }

    // Check if the user has liked within the last 5 hours
    const now = new Date().getTime();
    const lastLiked = user.lastLiked || 0;
    const timeSinceLastLike = now - lastLiked;
    const fiveHoursInMs = 5 * 60 * 60 * 1000;

    if (timeSinceLastLike < fiveHoursInMs) {
      const timeLeftInMs = fiveHoursInMs - timeSinceLastLike;
      const timeLeftInHours = Math.ceil(timeLeftInMs / (60 * 60 * 1000));
      req.flash(
        "error",
        `You can't like this user for another ${timeLeftInHours} hours.`
      );
      return res.redirect(`/user/${req.params.discordId}`);
    }

    // Update the user's like count and lastLiked timestamp
    await User.findOneAndUpdate(
      { discordId: req.params.discordId },
      {
        $inc: { likeCount: 1 },
        $set: { lastLiked: now },
      }
    );

    const successMessage = "Liked successfully!";
    req.flash("success", successMessage);

    // Redirect back to the user's profile
    res.redirect(`/user/${req.params.discordId}`);
  } catch (error) {
    console.error(error);
    req.flash("error", "Internal server error");
    res.redirect(`/user/${req.params.discordId}`);
  }
});

// discord bot like do not edit this yet
app.post("/user/:discordId/like/discord", async (req, res) => {
  try {
    // Check if user is trying to like themselves
    if (req.user.id === req.params.discordId) {
      return res.send("You cannot like yourself.");
    }

    // Check if the user has liked within the last 5 hours
    const now = new Date().getTime();
    const user = await User.findOne({ discordId: req.params.discordId });
    const lastLiked = user.lastLiked || 0;
    const timeSinceLastLike = now - lastLiked;
    const fiveHoursInMs = 5 * 60 * 60 * 1000;
    const timeLeftInMs = Math.max(fiveHoursInMs - timeSinceLastLike, 0);

    if (timeLeftInMs > 0) {
      const timeLeftInHours = Math.ceil(timeLeftInMs / (60 * 60 * 1000));
      return res.send(
        `You can't like this user for another ${timeLeftInHours} hours.`
      );
    }

    // Update the user's like count and lastLiked timestamp
    await User.findOneAndUpdate(
      { discordId: req.params.discordId },
      {
        $inc: { likeCount: 1 },
        $set: { lastLiked: now },
      }
    );

    const successMessage = "Liked successfully!";
    res.send(successMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.post("/certify", ensureAuthenticated, (req, res) => {
  const userIds = req.body.userIds; // get the list of user ids from the request body
  const authenticatedUser = req.user;

  // check if the authenticated user is an admin
  if (!allowedAdminIds.includes(authenticatedUser.discordId)) {
    res.status(403).send("You do not have permission to certify users");
    return;
  }

  // update the isCertified property for the users on the list
  User.updateMany({ _id: { $in: userIds } }, { $set: { isCertified: true } })
    .then(() => {
      res.redirect("/");
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Internal server error");
    });
});

app.get("/dashboard", ensureAuthenticated, (req, res) => {
  const error = ""; // Define the error variable
  res.render("dashboard", {
    user: req.user,
    error: error,
    authenticated: req.user,
    verifiedIds,
  });
});

app.post("/edit", ensureAuthenticated, (req, res) => {
  // Get the input fields from the form
  const bannerimage = req.body.bannerimage;
  const cardbannerimage = req.body.cardbannerimage;
  const newAboutme = req.body.aboutme; // Get the aboutme input from the form
  const newBio = req.body.bio;
  const github = req.body.github;
  const reason = req.body.reason;
  const newWebsite = req.body.website; // Get the new website value from the form
  const newTags = req.body.tags; // Get the tags input from the form

  // Remove any JavaScript code from the aboutme input
  const strippedAboutme = newAboutme.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
  const tagsArray = newTags.split(","); // Convert the tags input into an array of tags

  // Check that there are at most 3 tags
  if (tagsArray.length > 4) {
    const error = "You can only add up to 4 tags";
    res.render("dashboard", {
      user: req.user,
      error: error,
      authenticated: req.user,
      verifiedIds,
    });
    return;
  }

  const MAX_ABOUTME_LENGTH = 2237;
  if (strippedAboutme && strippedAboutme.length > MAX_ABOUTME_LENGTH) {
    const error = `About me must be less than ${MAX_ABOUTME_LENGTH} characters`;
    res.render("dashboard", {
      user: req.user,
      error: error,
      authenticated: req.user,
      verifiedIds,
    }); // Render the dashboard template with the error message
    return;
  }

  const MAX_BIO_LENGTH = 102;
  if (newBio && newBio.length > MAX_BIO_LENGTH) {
    const error = `Bio must be less than ${MAX_BIO_LENGTH} characters`;
    res.render("dashboard", {
      user: req.user,
      error: error,
      authenticated: req.user,
      verifiedIds,
    }); // Render the dashboard template with the error message
    return;
  }

  // Update the user's record in the database
  User.findOneAndUpdate(
    { _id: req.user.id },
    {
      $set: {
        bio: newBio,
        github: github,
        website: newWebsite,
        aboutme: strippedAboutme,
        bannerimage: bannerimage,
        cardbannerimage: cardbannerimage,
        tags: tagsArray,
      },
    },
    { new: true }
  )
    .exec()
    .then((user) => {
      const userId = user.discordId; // Get the user's Discord ID
      res.redirect(`/user/${userId}`); // Redirect to the user's page with their Discord ID in the URL
    })
    .catch((err) => {
      console.error(err);
      const error = "Internal server error"; // Define the error variable
      res.render("dashboard", {
        user: req.user,
        error: error,
        authenticated: req.user,
        verifiedIds,
      }); // Render the dashboard template with the error variable
    });
});

app.post("/update-user", ensureAuthenticated, async (req, res) => {
  const userId = req.user.discordId; // Get the user's Discord ID from the authenticated user object
  const { username, discriminator, avatarUrl } = req.body; // Get the updated user data from the request body

  try {
    const updatedUser = await User.findOneAndUpdate(
      { discordId: userId },
      { $set: { username, discriminator, avatarUrl } },
      { new: true }
    );
    console.log(`Updated user ${userId}: ${updatedUser}`);
    res.redirect(`/user/${userId}`); // Redirect to the user's page with their Discord ID in the URL
  } catch (err) {
    console.error(`Error updating user ${userId}: ${err}`);
    const error = "Internal server error"; // Define the error variable
    res.render("dashboard", { user: req.user, error }); // Render the dashboard template with the error variable
  }
});

// Define a middleware function to handle the search query
const searchMiddleware = (req, res, next) => {
  const query = req.query.q; // get the search query from the request parameters

  // Check if query is defined and is a string
  if (query && typeof query === "string") {
    User.find({
      $or: [
        { username: { $regex: query, $options: "i" } }, // search for username matches
        { tag: { $regex: query, $options: "i" } }, // search for tag matches
      ],
    })
      .exec()
      .then((users) => {
        // Add the search results to res.locals
        res.locals.searchResults = { users, query };
        next(); // Call the next middleware function
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Internal server error");
      });
  } else {
    next(); // Call the next middleware function
  }
};

// Use the search middleware on all routes
app.use(searchMiddleware);

// Render the search results page
app.get("/search", async (req, res) => {
  try {
    const query = req.query.q; // get the search query from the request query string
    const myArray = undefined;
    const joinedString = myArray ? myArray.join(",") : "";
    // search for users whose username, bio, or tags contain the search query
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { bio: { $regex: query, $options: "i" } },
        { tags: { $regex: query, $options: "i" } },
      ],
    }).exec();

    res.render("search", {
      query,
      users,
      authenticated: req.user,
      verifiedIds,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

const RealTimesearchMiddleware = (req, res, next) => {
  const query = req.query.q; // Get the search query from the request parameters

  // Check if query is defined and is a string
  if (query && typeof query === "string") {
    User.find({
      $or: [
        { username: { $regex: query, $options: "i" } }, // Search for username matches
        { tags: { $regex: query, $options: "i" } }, // Search for tag matches
      ],
    })
      .exec()
      .then((users) => {
        // Add the search results to res.locals
        res.locals.searchResults = { users, query };
        next(); // Call the next middleware function
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Internal server error");
      });
  } else {
    next(); // Call the next middleware function
  }
};

// Use the search middleware on the /realtimesearch route
app.get("/realtimesearch", RealTimesearchMiddleware, (req, res) => {
  const { searchResults } = res.locals;

  // Check if search results are available
  if (searchResults) {
    // Extract the users and query from search results
    const { users, query } = searchResults;

    // Map the users to include the necessary fields
    const usersWithFields = users.map((user) => {
      return {
        discordId: user.discordId,
        username: user.username,
        tags: user.tags,
        avatarUrl: user.avatarUrl,
      };
    });

    // Send the JSON response
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ users: usersWithFields, query }));
  } else {
    // No results found
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ message: "No results found" }));
  }
});

// Example route that can use the search results

app.get("/admin", ensureAuthenticated, isAdmin, (req, res) => {
  // This route is only accessible to admins
  res.render("panel/admin", { authenticated: req.user });
});

app.get("/admin/remove/:discordId", ensureAuthenticated, async (req, res) => {
  try {
    // Check if the authenticated user is an admin
    if (!allowedAdminIds.includes(req.user.discordId)) {
      return res.status(401).send("Unauthorized");
    }

    // Find the user with the given Discord ID and remove their profile
    const user = await User.findOneAndRemove({
      discordId: req.params.discordId,
    });

    // Check if the user was found and removed
    if (!user) {
      return res.send(
        `User with Discord ID ${req.params.discordId} does not exist.`
      );
    }

    // Return a success message
    res.send(`User ${user.tag} has been removed.`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/login", passport.authenticate("discord"));

app.get("/auth/callback", ensureAuthenticated, (req, res) => {
  res.send(`
      <script>
        window.opener.postMessage('authComplete', '*');
        window.close();
      </script>
      <p>Authentication successful. This window will close shortly.</p>`);
});

app.get(
  "/callback",
  passport.authenticate("discord", {
    successRedirect: "https://discordinflux.xyz/auth/callback",
    failureRedirect: "/login",
  })
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

app.get("/support", (req, res) => {
  res.redirect("https://discord.com/invite/qUG5GnWV8j");
});

app.get("*", (req, res) => {
  const { users, query } = res.locals.searchResults || {};

  res.render("404", { users, query, authenticated: req.user });
});

app.post("*", (req, res) => {
  const { users, query } = res.locals.searchResults || {};

  res.render("404", { users, query, authenticated: req.user });
});

client.login(process.env.token);

const port = 8080;

app.listen(port, () => {
  console.log(`Server is running on port ${port}...`);
  console.log(`Server running on ${process.platform} with Node.js ${process.version}.`);
  console.log(`WiFi signal strength: ${Math.floor(Math.random() * 100)}%`);
  console.log(`Download speed: ${Math.floor(Math.random() * 100)} Mbps`);
}).on('error', (error) => {
  console.log(`Error: ${error}`);
});

