const moment = require("moment-timezone");
const Alert = require("../models/alertModel");
const User = require("../models/userModel");
const Pill = require("../models/pillModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Helper function to convert UTC times to SAST
const convertAlertTimesToSAST = (alert) => {
  if (!alert.alertTimes) return alert;

  const convertedTimes = alert.alertTimes.map((time) => {
    const utcTime = moment
      .utc()
      .set({ hour: time.hours, minute: time.minutes });
    const sastTime = utcTime.tz("Africa/Johannesburg");

    return {
      hours: sastTime.hours(),
      minutes: sastTime.minutes(),
    };
  });

  return {
    ...alert.toObject(),
    alertTimes: convertedTimes,
  };
};

exports.createAlert = catchAsync(async (req, res, next) => {
  const { daysOfWeek, alertTimes, pills, isActive = true } = req.body;

  if (!daysOfWeek || daysOfWeek.length === 0) {
    return next(
      new AppError("Please select at least one day of the week", 400)
    );
  }

  if (!alertTimes || alertTimes.length === 0) {
    return next(
      new AppError("Please provide at least one alert time per day", 400)
    );
  }

  if (!pills || pills.length === 0) {
    return next(new AppError("Please select at least one pill", 400));
  }

  const timesPerDay = alertTimes.length;

  // Convert alertTimes from SAST to UTC before saving
  const parsedTimes = alertTimes.map((time) => {
    const sastTime = moment.tz(`1970-01-01 ${time}`, "Africa/Johannesburg"); // Assume input is SAST
    return {
      hours: sastTime.utc().hours(),
      minutes: sastTime.utc().minutes(),
    };
  });

  // Validate that all pills exist and belong to the logged-in user
  const userPills = await Pill.find({ _id: { $in: pills }, user: req.user.id });

  if (userPills.length !== pills.length) {
    return next(
      new AppError(
        "One or more pills are invalid or do not belong to the user",
        400
      )
    );
  }

  // Create a new alert linked to the user
  const newAlert = await Alert.create({
    daysOfWeek,
    timesPerDay,
    alertTimes: parsedTimes,
    isActive,
    user: req.user.id,
    pills,
  });

  await User.findByIdAndUpdate(req.user.id, {
    $push: { alerts: newAlert._id },
  });

  res.status(201).json({
    status: "success",
    data: { alert: newAlert },
  });
});

exports.getAllAlerts = catchAsync(async (req, res, next) => {
  const alerts = await Alert.find({ user: req.user.id }).populate("pills");

  // Convert alert times to SAST
  const alertsWithSAST = alerts.map((alert) => convertAlertTimesToSAST(alert));

  res.status(200).json({
    status: "success",
    results: alerts.length,
    data: { alerts: alertsWithSAST },
  });
});

exports.getAlert = catchAsync(async (req, res, next) => {
  const alert = await Alert.findOne({
    _id: req.params.id,
    user: req.user.id,
  }).populate("pills");

  if (!alert) return next(new AppError("No Alert found with that ID", 404));

  // Convert alert times to SAST
  const alertWithSAST = convertAlertTimesToSAST(alert);

  res.status(200).json({
    status: "success",
    data: { alert: alertWithSAST },
  });
});

exports.updateAlert = catchAsync(async (req, res, next) => {
  const { daysOfWeek, alertTimes, pills, isActive } = req.body;

  const alert = await Alert.findOne({ _id: req.params.id, user: req.user.id });
  if (!alert) return next(new AppError("No Alert found with that ID", 404));

  // Validate and convert alertTimes if provided
  if (alertTimes) {
    const parsedTimes = alertTimes.map((time) => {
      const sastTime = moment.tz(`1970-01-01 ${time}`, "Africa/Johannesburg");
      return {
        hours: sastTime.utc().hours(),
        minutes: sastTime.utc().minutes(),
      };
    });
    alert.alertTimes = parsedTimes;
    alert.timesPerDay = parsedTimes.length; // Update timesPerDay to match new number of alert times
  }

  // Validate and update pills if provided
  if (pills) {
    const userPills = await Pill.find({
      _id: { $in: pills },
      user: req.user.id,
    });
    if (userPills.length !== pills.length) {
      return next(
        new AppError(
          "One or more pills are invalid or do not belong to the user",
          400
        )
      );
    }
    alert.pills = pills;
  }

  if (daysOfWeek) alert.daysOfWeek = daysOfWeek;
  if (isActive !== undefined) alert.isActive = isActive; // Toggle active/inactive

  const updatedAlert = await alert.save();
  res.status(200).json({
    status: "success",
    data: { alert: updatedAlert },
  });
});

exports.deleteAlert = catchAsync(async (req, res, next) => {
  const alert = await Alert.findOneAndDelete({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!alert) return next(new AppError("No Alert found with that ID", 404));

  // Remove alert from user's alerts array
  await User.findByIdAndUpdate(req.user.id, {
    $pull: { alerts: req.params.id },
  });

  res.status(200).json({ message: "Alert deleted successfully" });
});

exports.toggleAlertStatus = catchAsync(async (req, res, next) => {
  const { isActive } = req.body;
  if (isActive === undefined) {
    return next(new AppError("Please provide isActive (true or false)", 400));
  }

  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { isActive },
    { new: true, runValidators: true }
  );

  if (!alert) return next(new AppError("No Alert found with that ID", 404));

  res.status(200).json({
    status: "success",
    message: `Alert ${isActive ? "activated" : "deactivated"} successfully`,
    data: { alert },
  });
});
