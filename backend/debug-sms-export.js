// Debug test script
console.log("Checking SMS service exports...");
const SMSService = require("./services/smsService");
console.log("SMSService type:", typeof SMSService);
console.log("Is constructor?", SMSService.toString().startsWith("class"));

try {
  console.log("Creating instance...");
  const instance = new SMSService();
  console.log("Instance created:", instance);
} catch (error) {
  console.error("Error creating instance:", error.message);
}
