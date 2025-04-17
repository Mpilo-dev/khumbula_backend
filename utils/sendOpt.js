const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const AppError = require("./appError");
const User = require("../models/userModel");

exports.sendOtp = async (phoneNumber, otp) => {
  try {
    await client.messages.create({
      body: `Your OTP is ${otp}. It expires in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
  } catch (error) {
    console.error("Twilio Error:", error);

    if (error.code === 21211) {
      throw new AppError(
        "Invalid phone number. Please check and try again.",
        400
      );
    } else {
      throw new AppError("Failed to send OTP. Please try again later.", 500);
    }
  }
};
