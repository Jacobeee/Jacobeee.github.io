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
// TEAM SEASON STATUS DETECTION
// =============================================================================

// Check if a team is currently in season based on recent games
async function getTeamSeasonStatus(teamAbbr, apiUrl) {
  try {
    const data = await fetchWithCache(apiUrl);
    const games = data.events || [];
    const now = new Date();
    
    // Look for games in the last 30 days and next 30 days
    const recentGames = games.filter(g => {
      const gameDate = new Date(g.date);
      const daysDiff = (gameDate - now) / (1000 * 60 * 60 * 24);
      return daysDiff >= -30 && daysDiff <= 30; // 30 days before and after
    });
    
    if (recentGames.length === 0) {
      return { status: "unknown", message: "No games found in season window" };
    }
    
    // Check if any recent games are regular season
    const regularSeasonGames = recentGames.filter(g => isRegularSeason(g));
    
    if (regularSeasonGames.length > 0) {
      // Find most recent completed game for additional info
      const completedGames = regularSeasonGames.filter(g => isCompletedGame(g, now));
      const upcomingGames = regularSeasonGames.filter(g => !isCompletedGame(g, now) && new Date(g.date) > now);
      
      let lastGameInfo = "";
      if (completedGames.length > 0) {
        const lastGame = completedGames[completedGames.length - 1];
        const gameDate = new Date(lastGame.date);
        const daysAgo = Math.floor((now - gameDate) / (1000 * 60 * 60 * 24));
        lastGameInfo = `Last game: ${daysAgo} days ago`;
      }
      
      let nextGameInfo = "";
      if (upcomingGames.length > 0) {
        const nextGame = upcomingGames[0];
        const gameDate = new Date(nextGame.date);
        const daysUntil = Math.floor((gameDate - now) / (1000 * 60 * 60 * 24));
        nextGameInfo = `Next game: ${daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}`;
      }
      
      const statusMessage = [lastGameInfo, nextGameInfo].filter(Boolean).join(" • ");
      
      return { 
        status: "in-season", 
        message: statusMessage || "Regular season active",
        recentGames: completedGames.length,
        upcomingGames: upcomingGames.length
      };
    }
    
    return { 
      status: "off-season", 
      message: "No regular season games in current window",
      totalGames: recentGames.length
    };
    
  } catch (error) {
    console.debug(`Error checking season status for ${teamAbbr}:`, error);
    return { status: "unknown", message: "Error checking season status" };
  }
}

// =============================================================================
// EXISTING UTILITY FUNCTIONS
// =============================================================================

// =============================================================================
// DEAL LOGIC MODULES
// =============================================================================

// Reusable deal check for team scoring X+ runs/points/goals
async function checkTeamScoringDeal(teamAbbr, apiUrl, minScore, dayLimit = 7, homeOnly = false, teamSeasonStatus = null) {
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
            mostRecentQualifying = { qualifying: true, game, gameDate, daysSince, score, teamSeasonStatus };
          }
        }
      }
    }
    
    if (mostRecentQualifying) {
      console.debug("Most recent qualifying game:", mostRecentQualifying);
      return mostRecentQualifying;
    }
    
    // Return with season status info for better messaging
    return { qualifying: false, teamSeasonStatus };
  } catch (error) {
    console.debug(`Error in scoring deal check for ${teamAbbr}:`, error);
    return { error: error.message };
  }
}

// Reusable deal check for wins
async function checkTeamWinDeal(teamAbbr, apiUrl, dayLimit = 7, teamSeasonStatus = null) {
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
        return { qualifying: true, game, gameDate, daysSince, teamSeasonStatus };
      }
    }
    
    return { qualifying: false, teamSeasonStatus };
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
        check: async (teamSeasonStatus) => {
          const result = await checkTeamScoringDeal("TB", ESPN_APIS.rays, 6, 7, false, teamSeasonStatus);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) {
            // Use season status to determine if it's offseason or just not active
            return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
          }
          
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
          
          return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
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
        check: async (teamSeasonStatus) => {
          const result = await checkTeamWinDeal("ORL", ESPN_APIS.magic, 7, teamSeasonStatus);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
          
          const { gameDate } = result;
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const gameDay = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
          
          if (gameDay.getTime() === yesterday.getTime()) {
            return "active";
          }
          
          return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
        },
        instructions: "Order online with code MAGICWIN the day after a win."
      },
      {
        name: "Checkers/Rally's Free Large Fry",
        condition: "Magic score 110+ points",
        check: async (teamSeasonStatus) => {
          const result = await checkTeamScoringDeal("ORL", ESPN_APIS.magic, 110, 7, false, teamSeasonStatus);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
          
          return "active"; // Active immediately after qualifying game
        },
        instructions: "Text MAGIC to 88001 after qualifying game."
      },
      {
        name: "Chick-fil-A Free Sandwich",
        condition: "Opponent misses 2 consecutive free throws in 4th quarter",
        check: async (teamSeasonStatus) => {
          // TODO: Implement missed free throw logic
          return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
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
        check: async (teamSeasonStatus) => {
          const result = await checkTeamScoringDeal("TB", ESPN_APIS.lightning, 4, 1, false, teamSeasonStatus); // 1 day limit
          
          if (result.error) return `Error: ${result.error}`;
          if (result.qualifying) return "active";
          
          // TODO: Add shutout detection logic
          return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
        },
        instructions: "Redeem at Wendy's within 24 hours after game."
      },
      {
        name: "Papa John's 50% Off",
        condition: "Lightning win",
        check: async (teamSeasonStatus) => {
          const result = await checkTeamWinDeal("TB", ESPN_APIS.lightning, 7, teamSeasonStatus);
          
          if (result.error) return `Error: ${result.error}`;
          if (!result.qualifying) return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
          
          const { gameDate } = result;
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          const gameDay = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
          
          if (gameDay.getTime() === yesterday.getTime()) {
            return "active";
          }
          
          return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
        },
        instructions: "Order online with code BOLTSW the day after a win."
      },
      {
        name: "Culver's Cheese Curds",
        condition: "Lightning score a goal in 3rd period (home games)",
        check: async (teamSeasonStatus) => {
          // TODO: Implement 3rd period goal logic for home games
          return teamSeasonStatus?.status === "in-season" ? "not active" : "offseason";
        },
        instructions: "Use code CURDS4BOLTS online the day after home game."
      }
    ]
  }
];

// =============================================================================
// PERFORMANCE OPTIMIZED RENDERING
// =============================================================================

// Batch process all deals with progress indicator and team season status
async function renderSportsDeals() {
  const container = document.getElementById("deals-panel");
  if (!container) return;
  
  // Show enhanced loading state
  container.innerHTML = `
    <div class="loading">
      <div style="font-size: 1.5em; margin-bottom: 15px;">⚡ Loading Sports Deals...</div>
      <div style="font-size: 1em; color: #666;">Checking latest game results and season status</div>
    </div>
  `;
  
  try {
    // Pre-warm cache by fetching all APIs in parallel
    console.debug("Pre-warming API cache...");
    const startTime = Date.now();
    
    await Promise.all([
      fetchWithCache(ESPN_APIS.rays),
      fetchWithCache(ESPN_APIS.magic),
      fetchWithCache(ESPN_APIS.lightning)
    ]);
    
    const loadTime = Date.now() - startTime;
    console.debug(`APIs loaded in ${loadTime}ms`);
    
    container.innerHTML = ""; // Clear loading state
    
    // Add header with last updated time
    const headerDiv = document.createElement("div");
    headerDiv.style.cssText = `
      text-align: center; 
      margin-bottom: 25px; 
      padding: 15px; 
      background: rgba(255,255,255,0.9); 
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    `;
    headerDiv.innerHTML = `
      <div style="font-size: 1.3em; font-weight: bold; color: #2c3e50; margin-bottom: 5px;">
        🏆 Live Sports Deals Status
      </div>
      <div style="font-size: 0.9em; color: #666;">
        Last updated: ${new Date().toLocaleString()} • 
        <span style="color: #27ae60;">Data loaded in ${loadTime}ms</span>
      </div>
    `;
    container.appendChild(headerDiv);
    
    // Process teams sequentially to show progressive updates
    for (const teamObj of sportsDeals) {
      // Get season status for this team
      const teamAbbr = teamObj.team === "Tampa Bay Rays" ? "TB" : 
                       teamObj.team === "Orlando Magic" ? "ORL" : 
                       teamObj.team === "Tampa Bay Lightning" ? "TB" : "TB";
      
      const apiUrl = teamObj.team === "Tampa Bay Rays" ? ESPN_APIS.rays :
                     teamObj.team === "Orlando Magic" ? ESPN_APIS.magic :
                     teamObj.team === "Tampa Bay Lightning" ? ESPN_APIS.lightning : ESPN_APIS.rays;
      
      const seasonStatus = await getTeamSeasonStatus(teamAbbr, apiUrl);
      
      const teamDiv = document.createElement("div");
      teamDiv.className = "team-deals";
      teamDiv.style.transform = "translateY(20px)";
      teamDiv.style.opacity = "0";
      
      const teamTitle = document.createElement("h2");
      
      // Add team emoji
      const teamEmoji = {
        "Tampa Bay Rays": "⚾",
        "Orlando Magic": "🏀", 
        "Tampa Bay Lightning": "🏒"
      };
      teamTitle.innerHTML = `${teamEmoji[teamObj.team] || "🏆"} ${teamObj.team}`;
      
      teamDiv.appendChild(teamTitle);
      
      // Add team status bar
      const statusBar = document.createElement("div");
      statusBar.className = `team-status-bar ${seasonStatus.status === "in-season" ? "in-season" : 
                                               seasonStatus.status === "off-season" ? "off-season" : "unknown"}`;
      
      const statusText = seasonStatus.status === "in-season" ? "In Season" :
                        seasonStatus.status === "off-season" ? "Off Season" : "Status Unknown";
      
      const statusDotClass = seasonStatus.status === "in-season" ? "active" :
                            seasonStatus.status === "off-season" ? "inactive" : "unknown";
      
      statusBar.innerHTML = `
        <div class="status-indicator">
          <div class="status-dot ${statusDotClass}"></div>
          <span>${statusText}</span>
        </div>
        <div class="season-info">${seasonStatus.message}</div>
      `;
      
      teamDiv.appendChild(statusBar);
      container.appendChild(teamDiv);
      
      // Animate team appearance
      setTimeout(() => {
        teamDiv.style.transition = "all 0.6s ease";
        teamDiv.style.transform = "translateY(0)";
        teamDiv.style.opacity = "1";
      }, 100);
      
      // Process deals in parallel for each team
      const dealPromises = teamObj.deals.map(async (deal) => {
        try {
          // Pass season status to deal check function
          const status = await deal.check(seasonStatus);
          return { deal, status };
        } catch (error) {
          console.error(`Error checking deal ${deal.name}:`, error);
          return { deal, status: `Error: ${error.message}` };
        }
      });
      
      const dealResults = await Promise.all(dealPromises);
      
      // Render all deals for this team with enhanced styling
      dealResults.forEach(({ deal, status }, index) => {
        const dealDiv = document.createElement("div");
        dealDiv.className = "deal";
        
        // Add status-specific styling and icons
        const statusClass = status === "active" ? "deal-active" : 
                           status === "offseason" ? "deal-offseason" : 
                           status.includes("Error") ? "deal-error" : "deal-inactive";
        
        // Enhanced status messages
        let enhancedStatus = status;
        if (status === "active") {
          enhancedStatus = "🎉 ACTIVE NOW!";
        } else if (status === "offseason") {
          enhancedStatus = "🏆 Off-Season";
        } else if (status.includes("activates in")) {
          enhancedStatus = `⏰ ${status}`;
        } else if (status === "not active") {
          enhancedStatus = "⏳ Not Active";
        }
        
        dealDiv.innerHTML = `
          <strong>${deal.name}</strong>
          <div style="color: #666; font-size: 0.95em; margin: 8px 0;">${deal.condition}</div>
          <div style="margin: 12px 0;">
            Status: <span class='deal-status ${statusClass}'>${enhancedStatus}</span>
          </div>
          <em>${deal.instructions}</em>
        `;
        
        // Add click interaction for more details
        dealDiv.style.cursor = "pointer";
        dealDiv.addEventListener("click", () => {
          if (status === "active") {
            dealDiv.style.animation = "activeGlow 0.5s ease-in-out";
            setTimeout(() => {
              dealDiv.style.animation = "";
            }, 500);
          }
        });
        
        teamDiv.appendChild(dealDiv);
        
        // Stagger deal animations
        setTimeout(() => {
          dealDiv.style.opacity = "0";
          dealDiv.style.transform = "translateX(-20px)";
          dealDiv.style.transition = "all 0.4s ease";
          setTimeout(() => {
            dealDiv.style.opacity = "1";
            dealDiv.style.transform = "translateX(0)";
          }, 50);
        }, index * 100);
      });
    }
    
    // Add footer with refresh option
    const footerDiv = document.createElement("div");
    footerDiv.style.cssText = `
      text-align: center; 
      margin-top: 30px; 
      padding: 20px; 
      background: rgba(255,255,255,0.9); 
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    `;
    footerDiv.innerHTML = `
      <button onclick="renderSportsDeals()" style="
        background: linear-gradient(135deg, #3498db, #2980b9);
        color: white;
        border: none;
        padding: 12px 25px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        margin: 0 10px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
      ">🔄 Refresh Deals</button>
      <button onclick="clearDealsCache(); renderSportsDeals();" style="
        background: linear-gradient(135deg, #95a5a6, #7f8c8d);
        color: white;
        border: none;
        padding: 12px 25px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        margin: 0 10px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(149, 165, 166, 0.3);
      ">🗑️ Clear Cache</button>
    `;
    container.appendChild(footerDiv);
    
    console.debug("All deals rendered successfully with enhanced UI");
    
  } catch (error) {
    console.error("Error rendering deals:", error);
    container.innerHTML = `
      <div class="error">
        <div style="font-size: 1.3em; margin-bottom: 10px;">❌ Error Loading Deals</div>
        <div>${error.message}</div>
        <button onclick="renderSportsDeals()" style="margin-top: 15px;">🔄 Try Again</button>
      </div>
    `;
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
