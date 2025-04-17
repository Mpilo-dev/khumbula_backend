const mongoose = require("mongoose");
const { Schema } = mongoose;

const pillSchema = new Schema({
  name: {
    type: String,
    required: [true, "Please provide pill name"],
    unique: true,
  },
  totalCapsules: {
    type: Number,
    required: [true, "Please provide total number of capsules"],
  },
  capsulesPerServing: {
    type: Number,
    required: [true, "Please provide quantity of capsules per serving"],
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

module.exports = mongoose.model("Pill", pillSchema);
