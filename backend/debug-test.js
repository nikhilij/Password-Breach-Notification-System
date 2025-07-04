// Debug test to understand the module loading issue
console.log("=== Debug Test ===");

try {
  const smsModule = require("./services/smsService");
  console.log("SMS Module:", smsModule);
  console.log("SMS Module keys:", Object.keys(smsModule));
  console.log("SMSService type:", typeof smsModule.SMSService);
  console.log("SMSService:", smsModule.SMSService);

  if (smsModule.SMSService) {
    const instance = new smsModule.SMSService();
    console.log("SMS Instance:", instance);
  }
} catch (error) {
  console.error("Error loading SMS module:", error);
}

try {
  const breachModule = require("./services/breachService");
  console.log("Breach Module:", breachModule);
  console.log("Breach Module keys:", Object.keys(breachModule));
  console.log("BreachService type:", typeof breachModule.BreachService);
  console.log("BreachService:", breachModule.BreachService);

  if (breachModule.BreachService) {
    const instance = new breachModule.BreachService();
    console.log("Breach Instance:", instance);
  }
} catch (error) {
  console.error("Error loading Breach module:", error);
}

console.log("=== End Debug Test ===");
