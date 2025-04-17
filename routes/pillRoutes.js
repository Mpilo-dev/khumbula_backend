const express = require("express");
const pillController = require("../controllers/pillController");
const authController = require("./../controllers/authController");

const router = express.Router();

router.use(authController.protect);

router
  .route("/")
  .get(pillController.getAllPills)
  .post(pillController.createPill);

router
  .route("/:id")
  .get(pillController.getPill)
  .patch(pillController.updatePill)
  .delete(pillController.deletePill);

module.exports = router;
