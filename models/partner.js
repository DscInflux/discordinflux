const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  logoUrl: { type: String },
  banner: { type: String },
  websiteUrl: { type: String },
  description: { type: String }
});

const Partner = mongoose.model('Partner', partnerSchema);

module.exports = Partner;
