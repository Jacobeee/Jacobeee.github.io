// deals.js - Optimized Sports deals forecast logic

// =============================================================================
// OPTIMIZATION LAYER - API Caching & Shared Utilities
// =============================================================================

// API Response Cache (5 minute TTL)
const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cached API fetch with CORS proxy
async function fetchWithCache(url) {
  const cacheKey = url;
  const cached = apiCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.debug("Using cached data for:", url);
    return cached.data;
  }
  
  console.debug("Fetching fresh data from:", url);
  const response = await fetch(url);
  const data = await response.json();
  
  apiCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

// Extract score from competitor object
function getScore(competitor) {
  if (!competitor?.score) return 0;
  
  if (typeof competitor.score.value === "number") {
    return competitor.score.value;
  } else if (typeof competitor.score.displayValue === "string") {
    return Number(competitor.score.displayValue);
  }
  return 0;
}

// Check if game is completed
function isCompletedGame(game, now = new Date()) {
  const statusType = game.status?.type || {};
  const state = statusType.state || "";
  const name = statusType.name || "";
  const gameDate = new Date(game.date);
  
  return gameDate <= now && (
    state === "post" || 
    name === "STATUS_FINAL" || 
    game.competitions?.[0]?.competitors?.some(c => c.score)
  );
}

// Check if game is regular season
function isRegularSeason(game) {
  const seasonType = game.seasonType?.type ?? game.season?.type;
  return seasonType === 2 || seasonType === "2";
}

// Get team competitor from game
function getTeamCompetitor(game, teamAbbr) {
  const competitors = game.competitions?.[0]?.competitors || [];
  return competitors.find(c => c.team?.abbreviation === teamAbbr);
}

// Get opponent competitor from game
function getOpponentCompetitor(game, teamAbbr) {
  const competitors = game.competitions?.[0]?.competitors || [];
  return competitors.find(c => c.team?.abbreviation !== teamAbbr);
}

// Common ESPN API endpoints
const ESPN_APIS = {
  rays: "https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/tb/schedule",
  magic: "https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/orl/schedule",
  lightning: "https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/tb/schedule"
};

// =============================================================================
// DEAL LOGIC MODULES
// =============================================================================

// Reusable deal check for team scoring X+ runs/points/goals
async function checkTeamScoringDeal(teamAbbr, apiUrl, minScore, dayLimit = 7, homeOnly = false) {
  try {
    const data = await fetchWithCache(apiUrl);
    const games = data.events || [];
    const now = new Date();
    
    // Process only recent games for efficiency
    const recentGames = games.filter(g => {
      const gameDate = new Date(g.date);
      const daysSince = (now - gameDate) / (1000 * 60 * 60 * 24);
      return daysSince >= 0 && daysSince <= 14; // Only check last 14 days
    });
    
    // Find the MOST RECENT qualifying game, not the first one
    let mostRecentQualifying = null;
    
    for (const game of recentGames.reverse()) {
      if (!isRegularSeason(game) || !isCompletedGame(game, now)) continue;
      
      const teamComp = getTeamCompetitor(game, teamAbbr);
      if (!teamComp) continue;
      
      // Check home/away requirement
      if (homeOnly && teamComp.homeAway !== "home") continue;
      
      const score = getScore(teamComp);
      console.debug(`Checking game ${game.date}: score=${score}, minScore=${minScore}`);
      
      if (score >= minScore) {
        const gameDate = new Date(game.date);
        const daysSince = (now - gameDate) / (1000 * 60 * 60 * 24);
        
        console.debug(`Qualifying game found: ${game.date}, score=${score}, daysSince=${daysSince}`);
        
        if (daysSince <= dayLimit) {
          // Keep track of the most recent one
          if (!mostRecentQualifying || gameDate > mostRecentQualifying.gameDate) {
            mostRecentQualifying = { qualifying: true, game, gameDate, daysSince, score };
          }
        }
      }
    }
    
    if (mostRecentQualifying) {
      console.debug("Most recent qualifying game:", mostRecentQualifying);
      return mostRecentQualifying;
    }
    
    return { qualifying: false };
  } catch (error) {
    console.debug(`Error in scoring deal check for ${teamAbbr}:`, error);
    return { error: error.message };
  }
}

// Reusable deal check for wins
async function checkTeamWinDeal(teamAbbr, apiUrl, dayLimit = 7) {
  try {
    const data = await fetchWithCache(apiUrl);
    const games = data.events || [];
    const now = new Date();
    
    const recentGames = games.filter(g => {
      const gameDate = new Date(g.date);
      const daysSince = (now - gameDate) / (1000 * 60 * 60 * 24);
      return daysSince >= 0 && daysSince <= 14;
    });
    
    for (const game of recentGames.reverse()) {
      if (!isRegularSeason(game) || !isCompletedGame(game, now)) continue;
      
      const teamComp = getTeamCompetitor(game, teamAbbr);
      if (!teamComp || !teamComp.winner) continue;
      
      const gameDate = new Date(game.date);
      const daysSince = (now - gameDate) / (1000 * 60 * 60 * 24);
      
      if (daysSince <= dayLimit) {
        return { qualifying: true, game, gameDate, daysSince };
      }
    }
    
    return { qualifying: false };
  } catch (error) {
    console.debug(`Error in win deal check for ${teamAbbr}:`, error);
    return { error: error.message };
  }
}

// =============================================================================
// DEAL CONFIGURATION
// =============================================================================

// Data structure for all deals
const sportsDeals = [
  {
    team: "Tampa Bay Rays",
    deals: [
      {
        name: "Tijuana Flats Taco & Chips",
        condition: "10+ strikeouts during a regular season home game",
        check: async () => {
          try {
            const data = await fetchWithCache(ESPN_APIS.rays);
            const games = data.events || [];
            const now = new Date();
            
            // Find most recent home game within 7 days
            for (const game of games.reverse()) {
              if (!isRegularSeason(game) || !isCompletedGame(game, now)) continue;
              
              const raysComp = getTeamCompetitor(game, "TB");
              if (!raysComp || raysComp.homeAway !== "home") continue;
              
              const gameDate = new Date(game.date);
              const daysSince = (now - gameDate) / (1000 * 60 * 60 * 24);
              
              if (daysSince > 7) continue;
              
              // Check strikeouts
              const stats = raysComp.statistics || [];
              const pitchingStats = stats.find(s => s.name === "pitching");
              const strikeoutStat = pitchingStats?.stats?.find(s => s.name === "strikeouts");
              const strikeouts = strikeoutStat ? Number(strikeoutStat.value) : 0;
              
              if (strikeouts >= 10 && daysSince <= 5) {
                return "active";
              }
              return "not active";
            }
            return "offseason";
          } catch (error) {
            return `Error: ${error.message}`;
          }
        },
        instructions: "Bring qualifying ticket or voucher to Kane's Showroom within 5 days. See kanesstrikeout.com."
      },
      {
        name: "Colony Grill Hot Oil Pizza",
        condition: "Rays hit a home run",
        check: async () => {
          // TODO: Implement home run detection logic
          return "offseason";
        },
        instructions: "Show ticket in MLB Ballpark app at Colony Grill within 7 days."
      },
      {
        name: "Culver's Cheese Curds",
        condition: "Rays score a run in the 3rd inning",
        check: async () => {
          // TODO: Implement 3rd inning scoring logic
          return "offseason";
        },
        instructions: "Use promo code CURDRUN online or in-app the day after the game."
      },
      {
        name: "Papa John's 50% Off",
        condition: "Rays score 6+ runs",
        check: async () => {
          const result = await checkTeamScoringDeal("TB", ESPN_APIS.rays, 6, 7);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) return "offseason";
          
          const { gameDate } = result;
          const now = new Date();
          
          // Use UTC dates to avoid timezone issues
          const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
          const yesterday = new Date(today);
          yesterday.setUTCDate(today.getUTCDate() - 1);
          const gameDay = new Date(Date.UTC(gameDate.getUTCFullYear(), gameDate.getUTCMonth(), gameDate.getUTCDate()));
          
          console.debug("Papa John's date check:", {
            gameDay: gameDay.toISOString(),
            today: today.toISOString(),
            yesterday: yesterday.toISOString(),
            gameTime: gameDay.getTime(),
            todayTime: today.getTime(),
            yesterdayTime: yesterday.getTime()
          });
          
          // Active the day after qualifying game
          if (gameDay.getTime() === yesterday.getTime()) {
            return "active";
          }
          
          // Show countdown if game was today
          if (gameDay.getTime() === today.getTime()) {
            const midnightUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
            const hoursUntil = (midnightUTC - now) / (1000 * 60 * 60);
            return `Deal activates in ${hoursUntil.toFixed(1)} hours`;
          }
          
          return "not active";
        },
        instructions: "Order online with code RAYS6 the day after the game."
      }
    ]
  },
  {
    team: "Orlando Magic",
    deals: [
      {
        name: "Papa John's 50% Off",
        condition: "Magic win",
        check: async () => {
          const result = await checkTeamWinDeal("ORL", ESPN_APIS.magic, 7);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) return "offseason";
          
          const { gameDate } = result;
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const gameDay = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
          
          if (gameDay.getTime() === yesterday.getTime()) {
            return "active";
          }
          
          return "not active";
        },
        instructions: "Order online with code MAGICWIN the day after a win."
      },
      {
        name: "Checkers/Rally's Free Large Fry",
        condition: "Magic score 110+ points",
        check: async () => {
          const result = await checkTeamScoringDeal("ORL", ESPN_APIS.magic, 110, 7);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) return "offseason";
          
          return "active"; // Active immediately after qualifying game
        },
        instructions: "Text MAGIC to 88001 after qualifying game."
      },
      {
        name: "Chick-fil-A Free Sandwich",
        condition: "Opponent misses 2 consecutive free throws in 4th quarter",
        check: async () => {
          // TODO: Implement missed free throw logic
          return "offseason";
        },
        instructions: "Redeem in Chick-fil-A app while at the arena."
      }
    ]
  },
  {
    team: "Tampa Bay Lightning",
    deals: [
      {
        name: "Wendy's Free Double Stack",
        condition: "Lightning shut out opponent OR score 4+ goals",
        check: async () => {
          const result = await checkTeamScoringDeal("TB", ESPN_APIS.lightning, 4, 1); // 1 day limit
          
          if (result.error) return `Error: ${result.error}`;
          if (result.qualifying) return "active";
          
          // TODO: Add shutout detection logic
          return "offseason";
        },
        instructions: "Redeem at Wendy's within 24 hours after game."
      },
      {
        name: "Papa John's 50% Off",
        condition: "Lightning win",
        check: async () => {
          const result = await checkTeamWinDeal("TB", ESPN_APIS.lightning, 7);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) return "offseason";
          
          const { gameDate } = result;
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const gameDay = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
          
          if (gameDay.getTime() === yesterday.getTime()) {
            return "active";
          }
          
          return "not active";
        },
        instructions: "Order online with code BOLTSW the day after a win."
      },
      {
        name: "Culver's Cheese Curds",
        condition: "Lightning score a goal in 3rd period (home games)",
        check: async () => {
          // TODO: Implement 3rd period goal logic for home games
          return "offseason";
        },
        instructions: "Use code CURDS4BOLTS online the day after home game."
      }
    ]
  }
];

// =============================================================================
// PERFORMANCE OPTIMIZED RENDERING
// =============================================================================

// Batch process all deals with progress indicator
async function renderSportsDeals() {
  const container = document.getElementById("deals-panel");
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<div class="loading">Loading deal statuses...</div>';
  
  try {
    // Pre-warm cache by fetching all APIs in parallel
    console.debug("Pre-warming API cache...");
    await Promise.all([
      fetchWithCache(ESPN_APIS.rays),
      fetchWithCache(ESPN_APIS.magic),
      fetchWithCache(ESPN_APIS.lightning)
    ]);
    
    container.innerHTML = ""; // Clear loading state
    
    // Process teams sequentially to show progressive updates
    for (const teamObj of sportsDeals) {
      const teamDiv = document.createElement("div");
      teamDiv.className = "team-deals";
      
      const teamTitle = document.createElement("h2");
      teamTitle.textContent = teamObj.team;
      teamDiv.appendChild(teamTitle);
      
      container.appendChild(teamDiv); // Add team header immediately
      
      // Process deals in parallel for each team
      const dealPromises = teamObj.deals.map(async (deal) => {
        try {
          const status = await deal.check();
          return { deal, status };
        } catch (error) {
          console.error(`Error checking deal ${deal.name}:`, error);
          return { deal, status: `Error: ${error.message}` };
        }
      });
      
      const dealResults = await Promise.all(dealPromises);
      
      // Render all deals for this team
      dealResults.forEach(({ deal, status }) => {
        const dealDiv = document.createElement("div");
        dealDiv.className = "deal";
        
        // Add status-specific styling
        const statusClass = status === "active" ? "deal-active" : 
                           status === "offseason" ? "deal-offseason" : 
                           status.includes("Error") ? "deal-error" : "deal-inactive";
        
        dealDiv.innerHTML = `
          <strong>${deal.name}</strong>: ${deal.condition}<br>
          Status: <span class='deal-status ${statusClass}'>${status}</span><br>
          <em>${deal.instructions}</em>
        `;
        
        teamDiv.appendChild(dealDiv);
      });
    }
    
    console.debug("All deals rendered successfully");
    
  } catch (error) {
    console.error("Error rendering deals:", error);
    container.innerHTML = `<div class="error">Error loading deals: ${error.message}</div>`;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Clear API cache (useful for testing)
function clearDealsCache() {
  apiCache.clear();
  console.debug("Deals cache cleared");
}

// Get cache status for debugging
function getCacheStatus() {
  const status = {};
  for (const [key, value] of apiCache.entries()) {
    const age = Date.now() - value.timestamp;
    status[key] = {
      age: Math.round(age / 1000) + "s",
      expired: age > CACHE_TTL
    };
  }
  return status;
}

// Debug function to test individual team APIs
async function testTeamAPI(team) {
  const apis = { rays: ESPN_APIS.rays, magic: ESPN_APIS.magic, lightning: ESPN_APIS.lightning };
  if (!apis[team]) {
    console.error("Unknown team:", team);
    return;
  }
  
  try {
    console.debug(`Testing ${team} API...`);
    const data = await fetchWithCache(apis[team]);
    console.debug(`${team} API response:`, data);
    return data;
  } catch (error) {
    console.error(`Error testing ${team} API:`, error);
    return null;
  }
}

// Export functions for browser console debugging
window.clearDealsCache = clearDealsCache;
window.getCacheStatus = getCacheStatus;
window.testTeamAPI = testTeamAPI;

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", renderSportsDeals);
