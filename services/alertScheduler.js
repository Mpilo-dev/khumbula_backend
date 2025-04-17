const cron = require("node-cron");
const moment = require("moment-timezone");
const sendSMS = require("../utils/sendAlert");
const Alert = require("../models/alertModel");

async function scheduleUserAlerts() {
  console.log("Initializing user alert schedules...");

  try {
    const alerts = await Alert.find({ isActive: true })
      .populate({
        path: "user",
        select: "firstName lastName phoneNumber",
      })
      .populate("pills");

    alerts.forEach((alert) => {
      // Skip if user is not found or deleted
      if (!alert.user) {
        console.log(`Skipping alert ${alert._id} - User not found`);
        return;
      }

      // Skip if user's phone number is not available
      if (!alert.user.phoneNumber) {
        console.log(
          `Skipping alert ${alert._id} - User phone number not found`
        );
        return;
      }

      alert.daysOfWeek.forEach((day) => {
        alert.alertTimes.forEach(({ hours, minutes }) => {
          const sastTime = moment
            .utc()
            .set({ hour: hours, minute: minutes })
            .tz("Africa/Johannesburg");

          const sastHours = sastTime.hours();
          const sastMinutes = sastTime.minutes();

          console.log(
            `Scheduling alert for ${alert.user.firstName} at ${sastHours}:${sastMinutes} SAST on ${day}`
          );

          const cronDays = {
            Sunday: 0,
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
          };

          cron.schedule(
            `${sastMinutes} ${sastHours} * * ${cronDays[day]}`,
            async () => {
              try {
                console.log(
                  `Running scheduled job for ${alert.user.firstName} at ${sastHours}:${sastMinutes} SAST`
                );

                // Re-fetch the alert to ensure it's still active and user exists
                const latestAlert = await Alert.findById(alert._id)
                  .populate({
                    path: "user",
                    select: "firstName lastName phoneNumber",
                  })
                  .populate("pills");

                if (!latestAlert || !latestAlert.isActive) {
                  console.log(
                    `Skipping alert for ${alert._id} because it is inactive.`
                  );
                  return;
                }

                if (!latestAlert.user) {
                  console.log(`Skipping alert ${alert._id} - User not found`);
                  return;
                }

                if (!latestAlert.user.phoneNumber) {
                  console.log(
                    `Skipping alert ${alert._id} - User phone number not found`
                  );
                  return;
                }

                if (latestAlert.pills && latestAlert.pills.length > 0) {
                  await sendSMS(latestAlert.user, latestAlert.pills);
                } else {
                  console.log(
                    `No pills associated with alert for ${latestAlert.user.firstName}`
                  );
                }
              } catch (err) {
                console.error(
                  `Error processing alert ${alert._id}:`,
                  err.message
                );
              }
            }
          );
        });
      });
    });
  } catch (err) {
    console.error("Error scheduling alerts:", err.message);
  }
}

module.exports = scheduleUserAlerts;
