const mongoose = require("mongoose");
const { Schema } = mongoose;
const bcrypt = require("bcrypt");

const userSchema = new Schema({
  firstName: {
    type: String,
    required: [true, "Please provide your first name"],
  },
  lastName: { type: String, required: [true, "Please provide your last name"] },
  userName: {
    type: String,
    required: [true, "Please provide your username"],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 8,
    select: false,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
    required: [true, "Please provide your gender"],
  },
  dateOfBirth: {
    type: Date,
    required: [true, "Please provide your date of birth"],
  },
  phoneNumber: {
    type: String,
    required: [true, "Please provide your phone number"],
    unique: true,
  },
  tempPhoneNumber: {
    type: String,
    select: false,
  },
  otp: {
    type: String,
    select: false,
  },
  otpExpires: {
    type: Date,
    select: false,
  },
  otpPurpose: {
    type: String,
    enum: ["phoneVerification", "resetPassword"],
    select: false,
  },
  otpVerified: {
    type: Boolean,
    default: false,
    select: false,
  },
  passwordChangedAt: { type: Date, select: false },
  pills: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pill",
    },
  ],
  alerts: [
    {
      type: Schema.Types.ObjectId,
      ref: "Alert",
    },
  ],
});

// Add phone number formatting middleware
userSchema.pre("save", function (next) {
  if (this.isModified("phoneNumber") || this.isNew) {
    if (!this.phoneNumber.startsWith("+")) {
      this.phoneNumber = `+27${this.phoneNumber.slice(1)}`;
    }
  }
  next();
});

userSchema.methods.createOtp = async function () {
  // generate random 6-digit
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  this.otp = await bcrypt.hash(otp, 10);
  // revert back to 10mins
  this.otpExpires = Date.now() + 60 * 60 * 1000;

  return otp;
};

// Password encrypt/hash
userSchema.pre("save", async function (next) {
  // Only run this function if password was actually modified or created new
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Update passwordChangedAt
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }
  // Password isn't changed
  return false;
};
module.exports = mongoose.model("User", userSchema);
