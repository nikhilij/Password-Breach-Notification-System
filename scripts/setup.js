const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Setting up Password Breach Notification System...\n");

// Check if .env file exists
const envPath = path.join(__dirname, "..", ".env");
if (!fs.existsSync(envPath)) {
  console.log("❌ .env file not found!");
  console.log(
    "📝 Please copy .env.example to .env and fill in your configuration",
  );
  console.log("   cp .env.example .env");
  process.exit(1);
}

console.log("✅ Environment file found");

// Install dependencies
console.log("📦 Installing dependencies...");
try {
  execSync("npm install", {
    stdio: "inherit",
    cwd: path.join(__dirname, "..", "backend"),
  });
  console.log("✅ Dependencies installed");
} catch (error) {
  console.error("❌ Failed to install dependencies:", error.message);
  process.exit(1);
}

// Check MongoDB connection
console.log("🔍 Checking MongoDB connection...");
try {
  const connectDB = require("../backend/config/db");
  connectDB();
  console.log("✅ MongoDB connection test passed");
} catch (error) {
  console.error("❌ MongoDB connection failed:", error.message);
  console.log(
    "💡 Make sure MongoDB is running and MONGODB_URI is correct in .env",
  );
  process.exit(1);
}

// Initialize database
console.log("🗄️  Initializing database...");
try {
  execSync("node ../databse/init.js", { stdio: "inherit", cwd: __dirname });
  console.log("✅ Database initialized");
} catch (error) {
  console.error("❌ Database initialization failed:", error.message);
  process.exit(1);
}

// Seed database (optional)
console.log("🌱 Seeding database with sample data...");
try {
  execSync("node ../databse/seed.js", { stdio: "inherit", cwd: __dirname });
  console.log("✅ Database seeded");
} catch (error) {
  console.error("❌ Database seeding failed:", error.message);
  console.log("⚠️  Continuing without sample data...");
}

console.log("\n🎉 Setup completed successfully!");
console.log("\n📖 Next steps:");
console.log("1. Review your .env file configuration");
console.log("2. Start the development server: npm run dev");
console.log(
  "3. Visit http://localhost:3000/health to verify the server is running",
);
console.log("4. Check the API documentation at http://localhost:3000/api");
console.log("\n🔐 Default admin credentials:");
console.log("   Email: admin@breachnotification.com");
console.log("   Password: AdminPassword123!");
console.log("\n📚 Available scripts:");
console.log("   npm run dev       - Start development server");
console.log("   npm test          - Run tests");
console.log("   npm run lint      - Run linting");
console.log("   npm run db:seed   - Seed database");
console.log("   npm run db:clear  - Clear seeded data");
console.log("   npm run alerts    - Send breach alerts");
console.log("   npm run digest    - Send weekly digest");
