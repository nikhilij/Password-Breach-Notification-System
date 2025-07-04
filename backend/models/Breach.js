const mongoose = require("mongoose");

const breachSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    passwordHash: {
      type: String,
      required: true, // SHA-1 hash of the password for privacy
    },
    breachSources: [
      {
        name: {
          type: String,
          required: true,
        },
        dateFound: {
          type: Date,
          required: true,
        },
        severity: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
        description: {
          type: String,
        },
        affectedAccounts: {
          type: Number,
          default: 0,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    firstDetected: {
      type: Date,
      default: Date.now,
    },
    lastChecked: {
      type: Date,
      default: Date.now,
    },
    timesFound: {
      type: Number,
      default: 1,
    },
    notificationsSent: {
      type: Number,
      default: 0,
    },
    userAcknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedAt: {
      type: Date,
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    recommendedActions: [
      {
        action: {
          type: String,
          required: true,
        },
        priority: {
          type: String,
          enum: ["low", "medium", "high"],
          default: "medium",
        },
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    metadata: {
      userAgent: String,
      ipAddress: String,
      location: String,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient queries
breachSchema.index({ userId: 1, isActive: 1 });
breachSchema.index({ passwordHash: 1 });
breachSchema.index({ firstDetected: -1 });
breachSchema.index({ "breachSources.dateFound": -1 });

// Method to calculate risk level based on sources
breachSchema.methods.calculateRiskLevel = function () {
  if (!this.breachSources || this.breachSources.length === 0) {
    return "low";
  }

  const highRiskSources = this.breachSources.filter(
    (source) => source.severity === "critical" || source.severity === "high",
  );

  if (highRiskSources.length > 0) {
    return "critical";
  }

  const mediumRiskSources = this.breachSources.filter(
    (source) => source.severity === "medium",
  );

  if (mediumRiskSources.length > 2) {
    return "high";
  }

  if (mediumRiskSources.length > 0) {
    return "medium";
  }

  return "low";
};

// Method to add recommended actions based on risk level
breachSchema.methods.generateRecommendedActions = function () {
  const actions = [];

  actions.push({
    action: "Change password immediately",
    priority: "high",
  });

  if (this.riskLevel === "critical" || this.riskLevel === "high") {
    actions.push({
      action: "Enable Two-Factor Authentication",
      priority: "high",
    });
    actions.push({
      action: "Review and update security questions",
      priority: "medium",
    });
    actions.push({
      action: "Check for unauthorized account access",
      priority: "high",
    });
  }

  actions.push({
    action: "Monitor account for suspicious activity",
    priority: "medium",
  });

  return actions;
};

// Pre-save middleware to calculate risk level and generate actions
breachSchema.pre("save", function (next) {
  if (this.isModified("breachSources")) {
    this.riskLevel = this.calculateRiskLevel();
    this.recommendedActions = this.generateRecommendedActions();
  }
  next();
});

module.exports = mongoose.model("Breach", breachSchema);
