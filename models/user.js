const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  discordId: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  discriminator: {
    type: String,
    required: true
  },
  bannerUrl: {
    type: String,
    required: false
  },
  cardbannerimage: {
    type: String,
    required: false
  },
  avatarUrl: {
    type: String,
    required: false
  },
  tags: {
    type: [String], // Define the tags field as an array of strings
    required: false
  },
  bio: {
    type: String,
    required: false
  },
  website: {
    type: String,
    required: false
  },
  icon: {
    type: String,
    required: false
  },
  aboutme: {
    type: String,
    required: false
  },
  reason: {
    type: String,
    required: false
  },
  bannerimage: {
    type: String,
    required: false
  },
  github: {
    type: String,
    required: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isCertified: {
    type: Boolean,
    default: false
  },
  hasNitro: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    default: false
  },
  monthlyViewCounts:
  {
    type: [Number],
    default: Array(12).fill(0)
  },
  Likes: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  lastLiked: { 
    type: Date 
  },
  lastButtonClicked: Date,
  lastLikeTime: Date
});


userSchema.virtual('hasLikedWithinFiveHours').get(function () {
  const now = new Date().getTime();
  const lastLiked = this.lastLiked ? this.lastLiked.getTime() : 0;
  const fiveHoursInMs = 5 * 60 * 60 * 1000;
  const timeSinceLastLike = now - lastLiked;
  return timeSinceLastLike < fiveHoursInMs;
});

const User = mongoose.model('User', userSchema);

module.exports = User;
