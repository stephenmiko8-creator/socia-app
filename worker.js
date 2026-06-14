// Local Background Worker for Social Auto-Poster
// This script simulates a production Cron Job by pinging the API every 60 seconds.

const INTERVAL_MS = 60000; // 60 seconds

console.log("=========================================");
console.log("🚀 Socia Local Background Worker Started!");
console.log(`⏱️  Checking for scheduled posts every ${INTERVAL_MS / 1000} seconds...`);
console.log("=========================================\n");

setInterval(async () => {
  const time = new Date().toLocaleTimeString();
  try {
    const res = await fetch("http://localhost:3000/api/cron");
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      console.log(`[${time}] 🟢 SUCCESS: Published ${data.results.length} post(s) to LinkedIn!`);
      data.results.forEach(r => console.log(`   -> Post ID: ${r.postId} | Platform: ${r.platform}`));
    } else {
      console.log(`[${time}] 🟡 Checked: ${data.message || "No posts due."}`);
    }
  } catch (err) {
    console.error(`[${time}] 🔴 ERROR: Could not reach the API. Is your Next.js server running?`);
    console.error(`   -> ${err.message}`);
  }
}, INTERVAL_MS);
