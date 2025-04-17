const express = require("express");
const userController = require("../controllers/userController");
const authController = require("../controllers/authController");

const router = express.Router();

// Protect all user routes
router.use(authController.protect);

router.patch("/updateMe", userController.updateMe);
// router.delete("/deleteMe", userController.deleteMe);

router
  .route("/:id")
  .get(userController.getUser)
  .delete(userController.deleteUser);

module.exports = router;
