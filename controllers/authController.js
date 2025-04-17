const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const { sendOtp } = require("../utils/sendOpt");
const AppError = require("../utils/appError");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    // In milliseconds
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  // Removes from output upon signup
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const {
    firstName,
    lastName,
    userName,
    password,
    gender,
    dateOfBirth,
    phoneNumber,
  } = req.body;

  let formattedPhoneNumber = phoneNumber;
  if (!phoneNumber.startsWith("+")) {
    formattedPhoneNumber = "+27" + phoneNumber.slice(1);
  }

  const user = new User({
    firstName,
    lastName,
    userName,
    password,
    gender,
    dateOfBirth,
    phoneNumber: formattedPhoneNumber,
  });

  const otp = await user.createOtp();
  user.otpPurpose = "phoneVerification";

  try {
    console.log(otp);
    await sendOtp(formattedPhoneNumber, otp);
  } catch (error) {
    return next(
      new AppError("Failed to send OTP. Please try again later.", 500)
    );
  }

  await user.save();

  res.status(202).json({
    status: "pending",
    message: "OTP sent to your phone. Please verify to complete signup.",
  });
});
// how to know which OTP you are resending?
exports.resendOtp = catchAsync(async (req, res, next) => {
  let { phoneNumber } = req.body;

  // 1️ Format phone number (convert "0712345678" → "+27 712345678")
  phoneNumber = phoneNumber.trim();
  if (phoneNumber.startsWith("0")) {
    phoneNumber = "+27" + phoneNumber.slice(1);
  }

  // 2️ Find user by phone number
  const user = await User.findOne({ phoneNumber }).select("+otp +otpExpires");

  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  // 3️ Check if an OTP was already sent recently
  const COOLDOWN_TIME = 2 * 60 * 1000; // 2 minutes cooldown
  if (user.otpExpires && user.otpExpires > Date.now() - COOLDOWN_TIME) {
    return next(
      new AppError("Please wait 2 minutes before requesting a new OTP.", 429)
    );
  }

  // 4️ Generate a new OTP
  const otp = await user.createOtp(); // This hashes the OTP and sets expiry

  // 5️ Attempt to send OTP via Twilio (or any SMS provider)
  try {
    await sendOtp(phoneNumber, otp);
  } catch (error) {
    return next(new AppError("Failed to send OTP. Please try again.", 500));
  }

  // 6️⃣ Save the new OTP in the database
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "OTP resent successfully.",
  });
});

exports.verifyOtp = catchAsync(async (req, res, next) => {
  const { phoneNumber, otp, otpPurpose } = req.body;

  // Validate purpose
  if (!["phoneVerification", "resetPassword"].includes(otpPurpose)) {
    return next(new AppError("Invalid OTP purpose.", 400));
  }

  // Format phone number
  const formattedPhoneNumber = phoneNumber.startsWith("+")
    ? phoneNumber
    : `+27${phoneNumber.slice(1)}`;

  // Find user with valid OTP
  const user = await User.findOne({
    $or: [
      { phoneNumber: formattedPhoneNumber },
      { tempPhoneNumber: formattedPhoneNumber },
    ],
    otpExpires: { $gt: Date.now() },
    otpPurpose: otpPurpose,
  }).select("+otp +otpExpires +otpPurpose +tempPhoneNumber");

  if (!user) {
    return next(new AppError("Invalid or expired OTP.", 400));
  }

  // Verify OTP matches
  const isValidOtp = await bcrypt.compare(otp, user.otp);
  if (!isValidOtp) {
    return next(new AppError("Invalid OTP code.", 400));
  }

  // Handle based on purpose
  if (otpPurpose === "phoneVerification") {
    // If this is a phone number update
    if (user.tempPhoneNumber) {
      user.phoneNumber = user.tempPhoneNumber;
      user.tempPhoneNumber = undefined;
    }

    // Clear OTP fields and log user in
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpPurpose = undefined;
    await user.save();

    createSendToken(user, 200, res);
  } else if (otpPurpose === "resetPassword") {
    // Mark as verified but keep OTP for reset step
    user.otpVerified = true;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "OTP verified. Proceed to reset password.",
      phoneNumber: user.phoneNumber,
    });
  }
});

exports.login = catchAsync(async (req, res, next) => {
  let { userName, phoneNumber, password } = req.body;

  if (!(userName || phoneNumber) || !password) {
    return next(
      new AppError(
        "Please provide a username or phone number and password",
        400
      )
    );
  }

  // 2 Format phone number if provided (convert "0712345678" → "+27 712345678")
  if (phoneNumber) {
    phoneNumber = phoneNumber.trim();
    if (phoneNumber.startsWith("0")) {
      phoneNumber = "+27" + phoneNumber.slice(1);
    }
  }

  // 3️ Find user by either userName or formatted phoneNumber
  const user = await User.findOne({
    $or: [{ userName }, { phoneNumber }],
  }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(
      new AppError("Incorrect username, phone number, or password", 401)
    );
  }

  // 4️ Send the JWT Token
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  //   1) check if token is there
  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  //   2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //   3) Check if user still exist
  // you need to test this [verify other number] [check if non-verified can login]
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError("The user belonging to this token does no longer exist", 401)
    );
  }

  //  4) Check if user changed password after the token was issued
  // need to test this one too
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again", 401)
    );
  }
  // Grant access to protected route
  req.user = currentUser;

  next();
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  let { phoneNumber } = req.body;

  phoneNumber = phoneNumber.trim();
  if (phoneNumber.startsWith("0")) {
    phoneNumber = "+27" + phoneNumber.slice(1);
  }

  const user = await User.findOne({ phoneNumber });

  if (!user) {
    return next(new AppError("User with this phone number not found.", 404));
  }

  const otp = await user.createOtp();
  user.otpPurpose = "resetPassword";

  try {
    await sendOtp(phoneNumber, otp);
  } catch (error) {
    return next(new AppError("Failed to send OTP. Please try again.", 500));
  }

  await user.save({ validateBeforeSave: false });

  res.status(202).json({
    status: "success",
    message: "OTP sent to your phone.",
  });
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const { phoneNumber, otp, newPassword } = req.body;

  if (!otp || !phoneNumber || !newPassword) {
    return next(
      new AppError("OTP, phone number and new password are required.", 400)
    );
  }

  // Format phone number
  const formattedPhoneNumber = phoneNumber.startsWith("+")
    ? phoneNumber
    : `+27${phoneNumber.slice(1)}`;

  // Find user with verified OTP for password reset
  const user = await User.findOne({
    phoneNumber: formattedPhoneNumber,
    otpPurpose: "resetPassword",
    otpVerified: true,
    otpExpires: { $gt: Date.now() },
  }).select("+otp +otpVerified +password");

  if (!user) {
    return next(new AppError("Invalid request or OTP expired.", 400));
  }

  // Final OTP verification
  const isValidOtp = await bcrypt.compare(otp, user.otp);
  if (!isValidOtp) {
    return next(new AppError("Invalid OTP.", 400));
  }

  // Update password and clear OTP fields
  user.password = newPassword;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.otpPurpose = undefined;
  user.otpVerified = undefined;
  user.passwordChangedAt = Date.now();

  await user.save();

  // Log the user in with new password
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select("+password");

  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  // 2) Check if posted current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  // 3) If so, update password
  user.password = req.body.password;

  // User.findByIdAndUpdate will not work because it won't run the validators
  await user.save();
  createSendToken(user, 200, res);
});
