import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

function loadDotEnv(path = ".env") {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI environment variable");
  process.exit(1);
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60000);
}

const now = new Date();

const sampleProps = [
  { sport: "Basketball", player: "LeBron James", team: null, stat: "Points", line: 27.5, status: "live", startTime: now },
  { sport: "Football", player: "Patrick Mahomes", team: null, stat: "Passing Yards", line: 305.5, status: "scheduled", startTime: minutesFromNow(60) },
  { sport: "Soccer", player: "Lionel Messi", team: null, stat: "Goals", line: 1.5, status: "scheduled", startTime: minutesFromNow(120) },
  { sport: "Baseball", player: "Shohei Ohtani", team: null, stat: "Dingers", line: 0.5, status: "scheduled", startTime: minutesFromNow(30) },
  { sport: "Baseball", player: "Shohei Ohtani", team: null, stat: "Dingers", line: 0.5, status: "scheduled", startTime: minutesFromNow(30) },
  { sport: "Baseball", player: "Shohei Ohtani", team: null, stat: "Dingers", line: 0.5, status: "scheduled", startTime: minutesFromNow(30) },
  { sport: "Basketball", player: "LeBron James", team: null, stat: "Points", line: 27.5, status: "live", startTime: now },
  { sport: "Football", player: "Patrick Mahomes", team: null, stat: "Passing Yards", line: 305.5, status: "scheduled", startTime: minutesFromNow(60) },
  { sport: "Soccer", player: "Lionel Messi", team: null, stat: "Goals", line: 1.5, status: "scheduled", startTime: minutesFromNow(120) },
  { sport: "Baseball", player: "Shohei Ohtani", team: null, stat: "Dingers", line: 0.5, status: "scheduled", startTime: minutesFromNow(30) },
  { sport: "Baseball", player: "Shohei Ohtani", team: null, stat: "Dingers", line: 0.5, status: "scheduled", startTime: minutesFromNow(30) },
  { sport: "Baseball", player: "Shohei Ohtani", team: null, stat: "Dingers", line: 0.5, status: "scheduled", startTime: minutesFromNow(30) },
].map((prop) => ({
  ...prop,
  result: null,
  createdAt: now,
  updatedAt: now,
}));

const client = new MongoClient(uri);

try {
  await client.connect();
  const collection = client.db().collection("playerProps");

  const existingCount = await collection.countDocuments();
  if (existingCount > 0) {
    console.log(`playerProps already has ${existingCount} document(s); skipping seed.`);
  } else {
    const result = await collection.insertMany(sampleProps);
    console.log(`Inserted ${result.insertedCount} sample player props.`);
  }
} finally {
  await client.close();
}
