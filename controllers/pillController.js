const Pill = require("../models/pillModel");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllPills = catchAsync(async (req, res, next) => {
  const pills = await Pill.find({ user: req.user.id });

  res.status(200).json({
    status: "success",
    results: pills.length,
    data: {
      pills,
    },
  });
});

exports.getPill = catchAsync(async (req, res, next) => {
  const pill = await Pill.findById(req.params.id);

  if (!pill) return next(new AppError("No Pill found with that ID", 404));

  res.status(200).json({
    status: "success",
    data: {
      pill,
    },
  });
});

exports.createPill = catchAsync(async (req, res, next) => {
  const { name, totalCapsules, capsulesPerServing } = req.body;
  const newPill = await Pill.create({
    name,
    totalCapsules,
    capsulesPerServing,
    user: req.user.id, // Assign the authenticated user's ID
  });

  await User.findByIdAndUpdate(req.user.id, { $push: { pills: newPill._id } });

  res.status(201).json({
    status: "success",
    data: {
      pill: newPill,
    },
  });
});

exports.updatePill = async (req, res, next) => {
  const { name, totalCapsules, capsulesPerServing } = req.body;

  const pill = await Pill.findById(req.params.id);
  if (!pill) return next(new AppError("No Pill found with that ID", 404));

  pill.name = name || pill.name;
  pill.totalCapsules = totalCapsules || pill.totalCapsules;
  pill.capsulesPerServing = capsulesPerServing || pill.capsulesPerServing;

  const updatedPill = await pill.save();

  res.status(200).json({
    status: "success",
    data: {
      pill: updatedPill,
    },
  });
};

exports.deletePill = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Find the pill
  const pill = await Pill.findById(id);
  if (!pill) return next(new AppError("No Pill found with that ID", 404));

  // Check if the logged-in user is the owner of the pill
  if (pill.user.toString() !== req.user.id) {
    return next(
      new AppError("You do not have permission to delete this pill", 403)
    );
  }

  // Delete the pill and remove from user's array
  await Pill.findByIdAndDelete(id);
  await User.findByIdAndUpdate(req.user.id, { $pull: { pills: id } });

  res.status(204).json({
    status: "success",
    data: null,
  });
});
