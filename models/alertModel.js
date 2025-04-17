const mongoose = require("mongoose");
const { Schema } = mongoose;

const alertSchema = new Schema({
  daysOfWeek: [
    {
      type: String,
      enum: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      required: [true, "Please specify the days of the week for the alerts"],
    },
  ],
  timesPerDay: {
    type: Number,
    required: true,
    min: [1, "At least one reminder per day is required"],
  },
  alertTimes: [
    {
      hours: { type: Number, required: true },
      minutes: { type: Number, required: true },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  pills: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Pill", required: true },
  ],
});

module.exports = mongoose.model("Alert", alertSchema);
