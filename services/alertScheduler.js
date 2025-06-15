const cron = require("node-cron");
const moment = require("moment-timezone");
const sendSMS = require("../utils/sendAlert");
const Alert = require("../models/alertModel");

// Store active cron jobs
const activeJobs = new Map();

function scheduleAlert(alert) {
  // Skip if user is not found or deleted
  if (!alert.user) {
    console.log(`Skipping alert ${alert._id} - User not found`);
    return;
  }

  // Skip if user's phone number is not available
  if (!alert.user.phoneNumber) {
    console.log(`Skipping alert ${alert._id} - User phone number not found`);
    return;
  }

  // Cancel existing jobs for this alert if any
  if (activeJobs.has(alert._id.toString())) {
    const existingJobs = activeJobs.get(alert._id.toString());
    existingJobs.forEach((job) => job.stop());
    activeJobs.delete(alert._id.toString());
  }

  const jobs = [];

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

      const job = cron.schedule(
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
            console.error(`Error processing alert ${alert._id}:`, err.message);
          }
        }
      );

      jobs.push(job);
    });
  });

  // Store the jobs for this alert
  activeJobs.set(alert._id.toString(), jobs);
}

async function scheduleUserAlerts() {
  console.log("Initializing user alert schedules...");

  try {
    const alerts = await Alert.find({ isActive: true })
      .populate({
        path: "user",
        select: "firstName lastName phoneNumber",
      })
      .populate("pills");

    alerts.forEach(scheduleAlert);
  } catch (err) {
    console.error("Error scheduling alerts:", err.message);
  }
}

// Function to cancel all jobs for an alert
function cancelAlertJobs(alertId) {
  if (activeJobs.has(alertId.toString())) {
    const jobs = activeJobs.get(alertId.toString());
    jobs.forEach((job) => job.stop());
    activeJobs.delete(alertId.toString());
  }
}

module.exports = {
  scheduleUserAlerts,
  scheduleAlert,
  cancelAlertJobs,
};
