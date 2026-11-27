import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendations } from "../src/recommendations.js";

const scenarios = [
  {
    "name": "empty household profile",
    "profile": {},
    "expected": null
  },
  {
    "name": "missing AQI",
    "profile": {
      "householdSize": 4,
      "budget": "low",
      "commute": "mixed"
    },
    "expected": null
  },
  {
    "name": "good AQI baseline",
    "profile": {
      "aqi": 25,
      "householdSize": 3
    },
    "expected": null
  },
  {
    "name": "satisfactory AQI",
    "profile": {
      "aqi": 75
    },
    "expected": null
  },
  {
    "name": "moderate AQI",
    "profile": {
      "aqi": 150
    },
    "expected": null
  },
  {
    "name": "poor AQI",
    "profile": {
      "aqi": 250
    },
    "expected": "Poor-or-worse range"
  },
  {
    "name": "very poor AQI",
    "profile": {
      "aqi": 350
    },
    "expected": "Avoid outdoor exertion"
  },
  {
    "name": "severe AQI",
    "profile": {
      "aqi": 450
    },
    "expected": "Avoid outdoor exertion"
  },
  {
    "name": "AQI upper boundary",
    "profile": {
      "aqi": 500
    },
    "expected": "Avoid outdoor exertion"
  },
  {
    "name": "child in household",
    "profile": {
      "vulnerable": [
        "children"
      ]
    },
    "expected": "sensitive"
  },
  {
    "name": "older adult in household",
    "profile": {
      "vulnerable": [
        "older-adults"
      ]
    },
    "expected": "sensitive"
  },
  {
    "name": "respiratory sensitivity",
    "profile": {
      "vulnerable": [
        "respiratory"
      ]
    },
    "expected": "sensitive"
  },
  {
    "name": "multiple sensitive groups",
    "profile": {
      "vulnerable": [
        "children",
        "older-adults",
        "respiratory"
      ]
    },
    "expected": "sensitive"
  },
  {
    "name": "low budget solo car commute",
    "profile": {
      "budget": "low",
      "commute": "car"
    },
    "expected": "Potentially lower"
  },
  {
    "name": "flexible budget walking commute",
    "profile": {
      "budget": "flexible",
      "commute": "walk"
    },
    "expected": "purchase"
  },
  {
    "name": "two-wheeler commute",
    "profile": {
      "commute": "two-wheeler"
    },
    "expected": "shared auto"
  },
  {
    "name": "public bus commute",
    "profile": {
      "commute": "bus"
    },
    "expected": "Combine errands"
  },
  {
    "name": "auto commute",
    "profile": {
      "commute": "auto"
    },
    "expected": "Combine errands"
  },
  {
    "name": "mixed commute",
    "profile": {
      "commute": "mixed"
    },
    "expected": "Combine errands"
  },
  {
    "name": "early morning schedule",
    "profile": {
      "schedule": "morning"
    },
    "expected": "early"
  },
  {
    "name": "evening schedule",
    "profile": {
      "schedule": "evening"
    },
    "expected": "evening"
  },
  {
    "name": "daytime schedule",
    "profile": {
      "schedule": "daytime"
    },
    "expected": "daytime"
  },
  {
    "name": "variable schedule",
    "profile": {
      "schedule": "variable"
    },
    "expected": "close to each planned"
  },
  {
    "name": "single-person household",
    "profile": {
      "householdSize": 1
    },
    "expected": null
  },
  {
    "name": "large household",
    "profile": {
      "householdSize": 20
    },
    "expected": "For a household of 20"
  },
  {
    "name": "severe AQI with children",
    "profile": {
      "aqi": 410,
      "vulnerable": [
        "children"
      ]
    },
    "expected": "Avoid outdoor exertion"
  },
  {
    "name": "poor AQI with older adults",
    "profile": {
      "aqi": 220,
      "vulnerable": [
        "older-adults"
      ]
    },
    "expected": "Poor-or-worse range"
  },
  {
    "name": "severe AQI with respiratory sensitivity",
    "profile": {
      "aqi": 480,
      "vulnerable": [
        "respiratory"
      ]
    },
    "expected": "Avoid outdoor exertion"
  },
  {
    "name": "zero AQI value",
    "profile": {
      "aqi": 0
    },
    "expected": null
  },
  {
    "name": "null AQI",
    "profile": {
      "aqi": null
    },
    "expected": null
  }
];

for (const scenario of scenarios) {
  test(`AI guidance evaluation: ${scenario.name}`, () => {
    const recommendations = buildRecommendations(scenario.profile);
    assert.ok(recommendations.length >= 7, "should provide a complete practical action set");
    assert.ok(recommendations.every(item =>
      typeof item.title === "string" && item.title.length > 5 &&
      typeof item.action === "string" && item.action.length > 15 &&
      typeof item.why === "string" && item.why.length > 10 &&
      typeof item.cost === "string" && typeof item.benefit === "string"
    ), "every recommendation must include actionable and explainable fields");
    if (scenario.expected === "sensitive") {
      assert.equal(recommendations[0].title, "Plan around household members who may be more sensitive");
    } else if (scenario.expected) {
      const allText = recommendations.map(item => `${item.title} ${item.action} ${item.cost} ${item.benefit} ${item.why}`).join(" ");
      assert.ok(allText.toLowerCase().includes(scenario.expected.toLowerCase()),
        `expected guidance phrase: ${scenario.expected}`);
    }
    if (scenario.profile.aqi === undefined || scenario.profile.aqi === null) {
      const exercise = recommendations.find(item => item.title.includes("strenuous exercise"));
      assert.ok(exercise);
    }
  });
}
