const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};

  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select("-__v");

  if (!user) {
    return next(new AppError("No user found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});
exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password) {
    return next(
      new AppError(
        "This route is not for password updates. Please use /updateMyPassword",
        400
      )
    );
  }

  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "userName",
    "gender",
    "dateOfBirth"
  );

  const user = await User.findById(req.user.id);

  if (req.body.phoneNumber) {
    let newPhoneNumber = req.body.phoneNumber.trim();

    if (newPhoneNumber.startsWith("0")) {
      newPhoneNumber = "+27" + newPhoneNumber.slice(1);
    }

    // Check if the new phone number is different from current
    if (newPhoneNumber === user.phoneNumber) {
      return next(
        new AppError("New phone number must be different from current.", 400)
      );
    }

    // Check if phone number is already in use
    const existingUser = await User.findOne({ phoneNumber: newPhoneNumber });
    if (existingUser) {
      return next(new AppError("Phone number is already in use.", 400));
    }

    const otp = await user.createOtp();
    user.otpPurpose = "phoneVerification";
    user.tempPhoneNumber = newPhoneNumber;

    try {
      await sendOtp(newPhoneNumber, otp);
    } catch (error) {
      return next(new AppError("Failed to send OTP. Try again later.", 500));
    }

    await user.save({ validateBeforeSave: false });

    return res.status(202).json({
      status: "pending",
      message: "OTP sent to new phone number. Verify to complete update.",
      data: { user: filteredBody },
    });
  }

  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError("No user found with that ID", 404));
  }

  res.status(204).json({
    status: "success",
    message: "User deleted successfully",
    data: null,
  });
});

exports.verifyUpdatedPhoneOtp = catchAsync(async (req, res, next) => {
  const { otp } = req.body;

  const user = await User.findById(req.user.id).select(
    "+otp +otpExpires +tempPhoneNumber"
  );

  if (!user || !user.otp || !user.tempPhoneNumber) {
    return next(new AppError("No pending phone update request.", 400));
  }

  // Compare OTP
  const isMatch = await bcrypt.compare(otp, user.otp);
  if (!isMatch || user.otpExpires < Date.now()) {
    return next(new AppError("Invalid or expired OTP.", 400));
  }

  // ✅ Finalize phone number update
  user.phoneNumber = user.tempPhoneNumber;
  user.tempPhoneNumber = undefined;

  // ✅ Clear OTP fields
  user.otp = undefined;
  user.otpExpires = undefined;

  await user.save();

  // ✅ Generate new JWT since phone number changed
  createSendToken(user, 200, res);
});
