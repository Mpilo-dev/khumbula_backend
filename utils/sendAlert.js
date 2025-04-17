const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

async function sendSMS(user, pills) {
  try {
    if (!pills || pills.length === 0) {
      console.log(`No pill data found for ${user.firstName}. Skipping SMS.`);
      return;
    }

    const pillDetails = pills
      .map((pill) => `${pill.name} x ${pill.capsulesPerServing} capsules`)
      .join("\n");

    const message = `Hello ${user.firstName} ${user.lastName}! This is your reminder to take your medication:\n${pillDetails}`;

    await client.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: user.phoneNumber,
    });

    console.log(`SMS sent to ${user.phoneNumber}: ${message}`);
  } catch (err) {
    console.error("Error sending SMS:", err.message);
  }
}

module.exports = sendSMS;
