// deals.js - Sports deals forecast logic

// Data structure for all deals
const sportsDeals = [
  {
    team: "Tampa Bay Rays",
    deals: [
      {
        name: "Tijuana Flats Taco & Chips",
          condition: "10+ strikeouts during a regular season home game",
          check: async () => {
            // ESPN Rays schedule API endpoint
            const apiUrl = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/tb/schedule";
            try {
              const response = await fetch(apiUrl);
              const data = await response.json();
              const games = data.events || [];
              const now = new Date();
              let latestGame = null;
              for (let i = games.length - 1; i >= 0; i--) {
                const g = games[i];
                const isHome = g.competitions?.[0]?.venue?.id && g.competitions[0].competitors?.[0]?.homeAway === "home";
                const isRegular = g.season?.type === 2;
                const isFinal = g.status?.type?.completed;
                if (isHome && isRegular && isFinal) {
                  latestGame = g;
                  break;
                }
              }
              if (!latestGame) return "offseason";
              const gameDate = new Date(latestGame.date);
              const daysSince = (now - gameDate) / (1000 * 60 * 60 * 24);
              if (daysSince > 7) return "offseason";
              // Check Rays pitcher strikeouts
              const stats = latestGame.competitions?.[0]?.competitors?.find(c => c.team?.abbreviation === "TB")?.statistics;
              let strikeouts = 0;
              if (stats) {
                const kStat = stats.find(s => s.name === "pitching");
                if (kStat && kStat.stats) {
                  const kObj = kStat.stats.find(s => s.name === "strikeouts");
                  if (kObj) strikeouts = Number(kObj.value);
                }
              }
              if (strikeouts >= 10 && daysSince <= 5) return "active";
              return "not active";
            } catch (e) {
              return "offseason";
            }
          },
        instructions: "Bring qualifying ticket or voucher to Kane's Showroom within 5 days. See kanesstrikeout.com."
      },
      {
        name: "Colony Grill Hot Oil Pizza",
        condition: "Rays hit a home run",
        check: async () => {
          // Placeholder: implement ESPN API logic for home runs
          return "offseason";
        },
        instructions: "Show ticket in MLB Ballpark app at Colony Grill within 7 days."
      },
      {
        name: "Culver's Cheese Curds",
        condition: "Rays score a run in the 3rd inning",
        check: async () => {
          // Placeholder: implement ESPN API logic for 3rd inning run
          return "offseason";
        },
        instructions: "Use promo code CURDRUN online or in-app the day after the game."
      },
      {
        name: "Papa John's 50% Off",
        condition: "Rays score 6+ runs",
            check: async () => {
              // ESPN Rays schedule API endpoint
              const apiUrl = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/tb/schedule";
              try {
                const response = await fetch(apiUrl);
                const data = await response.json();
                const games = data.events || [];
                const now = new Date();
                // Find the most recent qualifying game (Rays scored 6+ runs)
                let qualifyingGame = null;
                let prevQualifyingGame = null;
                for (let i = games.length - 1; i >= 0; i--) {
                  const g = games[i];
                  const isRegular = g.season?.type === 2;
                  const isFinal = g.status?.type?.completed;
                  if (isRegular && isFinal) {
                    const competitors = g.competitions?.[0]?.competitors || [];
                    const rays = competitors.find(c => c.team?.abbreviation === "TB");
                    const raysScore = rays?.score ? Number(rays.score) : 0;
                    if (raysScore >= 6) {
                      const gameDate = new Date(g.date);
                      const daysSince = (now - gameDate) / (1000 * 60 * 60 * 24);
                      if (!qualifyingGame && daysSince <= 7) {
                        qualifyingGame = { game: g, gameDate, daysSince };
                      } else if (!prevQualifyingGame && qualifyingGame) {
                        prevQualifyingGame = { game: g, gameDate, daysSince };
                        break;
                      }
                    }
                  }
                }
                if (!qualifyingGame) return "offseason";
                // Only valid on the day after a qualifying game, unless previous day was also qualifying
                const today = now;
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const qDate = qualifyingGame.gameDate;
                const isYesterday = qDate.getUTCFullYear() === yesterday.getUTCFullYear() && qDate.getUTCMonth() === yesterday.getUTCMonth() && qDate.getUTCDate() === yesterday.getUTCDate();
                if (isYesterday) {
                  // Check if previous day was also qualifying
                  if (prevQualifyingGame) {
                    const prevDate = prevQualifyingGame.gameDate;
                    const prevIsYesterday = prevDate.getUTCFullYear() === yesterday.getUTCFullYear() && prevDate.getUTCMonth() === yesterday.getUTCMonth() && prevDate.getUTCDate() === yesterday.getUTCDate();
                    if (prevIsYesterday) return "active";
                  }
                  return "active";
                }
                // If qualifying game is today, show hours until midnight UTC
                const isToday = qDate.getUTCFullYear() === today.getUTCFullYear() && qDate.getUTCMonth() === today.getUTCMonth() && qDate.getUTCDate() === today.getUTCDate();
                if (isToday) {
                  // Calculate hours until midnight UTC
                  const midnightUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1, 0, 0, 0));
                  const hoursUntil = (midnightUTC - today) / (1000 * 60 * 60);
                  return `Deal will be activated in ${hoursUntil.toFixed(1)} hours (at midnight UTC)`;
                }
                // Otherwise, not active
                return "not active";
              } catch (e) {
                return "offseason";
              }
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
          // Placeholder: implement ESPN API logic for win
          return "offseason";
        },
        instructions: "Order online with code MAGICWIN the day after a win."
      },
      {
        name: "Checkers/Rally's Free Large Fry",
        condition: "Magic score 110+ points",
        check: async () => {
          // Placeholder: implement ESPN API logic for points
          return "offseason";
        },
        instructions: "Text MAGIC to 88001 after qualifying game."
      },
      {
        name: "Chick-fil-A Free Sandwich",
        condition: "Opponent misses 2 consecutive free throws in 4th quarter",
        check: async () => {
          // Placeholder: implement ESPN API logic for missed free throws
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
          // Placeholder: implement ESPN API logic for shutout/goals
          return "offseason";
        },
        instructions: "Redeem at Wendy's within 24 hours after game."
      },
      {
        name: "Papa John's 50% Off",
        condition: "Lightning win",
        check: async () => {
          // Placeholder: implement ESPN API logic for win
          return "offseason";
        },
        instructions: "Order online with code BOLTSW the day after a win."
      },
      {
        name: "Culver's Cheese Curds",
        condition: "Lightning score a goal in 3rd period (home games)",
        check: async () => {
          // Placeholder: implement ESPN API logic for 3rd period goal
          return "offseason";
        },
        instructions: "Use code CURDS4BOLTS online the day after home game."
      }
    ]
  }
];

// Utility to check if a team is in season (placeholder)
function isTeamInSeason(team) {
  // TODO: Implement logic based on current date and league schedule
  return false;
}

// Render deals to the page (to be called from HTML)
async function renderSportsDeals() {
  const container = document.getElementById("deals-panel");
  if (!container) return;
  container.innerHTML = "";
  for (const teamObj of sportsDeals) {
    const teamDiv = document.createElement("div");
    teamDiv.className = "team-deals";
    const teamTitle = document.createElement("h2");
    teamTitle.textContent = teamObj.team;
    teamDiv.appendChild(teamTitle);
    for (const deal of teamObj.deals) {
      const dealDiv = document.createElement("div");
      dealDiv.className = "deal";
      const status = await deal.check();
      dealDiv.innerHTML = `<strong>${deal.name}</strong>: ${deal.condition}<br>Status: <span class='deal-status'>${status}</span><br><em>${deal.instructions}</em>`;
      teamDiv.appendChild(dealDiv);
    }
    container.appendChild(teamDiv);
  }
}

document.addEventListener("DOMContentLoaded", renderSportsDeals);
