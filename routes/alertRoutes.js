const express = require("express");
const alertController = require("../controllers/alertController");
const authController = require("../controllers/authController");

const router = express.Router();

router.use(authController.protect);

router
  .route("/")
  .post(alertController.createAlert)
  .get(alertController.getAllAlerts);

router
  .route("/:id")
  .get(alertController.getAlert)
  .patch(alertController.updateAlert)
  .delete(alertController.deleteAlert);

router.patch("/:id/status", alertController.toggleAlertStatus);

module.exports = router;
