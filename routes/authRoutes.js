const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/resend-otp", authController.resendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/login", authController.login);
router.post("/forgotPassword", authController.forgotPassword);
router.post("/resetPassword", authController.resetPassword);

router.use(authController.protect); // Protect routes below this middleware

router.patch("/updateMyPassword", authController.updatePassword);

module.exports = router;
