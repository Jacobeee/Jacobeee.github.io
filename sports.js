// sports.js - fetch and display sports/game info for index.html

window.addEventListener('DOMContentLoaded', function() {
    const resultElement = document.getElementById("result");
    if (!resultElement) return;
    // Tampa Bay Lightning games
    fetch("https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/tb/schedule")
        .then(response => response.json())
        .then(data => {
            const games = data.events;
            const now = new Date();
            const gamesPast = games.filter(game => new Date(game.date) < now);
            const upcomingGames = games.filter(game => new Date(game.date) > now);
            if (gamesPast.length > 0) {
                const lastGame = gamesPast[gamesPast.length - 1];
                const nextGame = upcomingGames[0];
                const lastGameDate = new Date(lastGame.date);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (lastGameDate.toDateString() === yesterday.toDateString()) {
                    const tampaBayL = lastGame.competitions[0].competitors.find(team => team.team.abbreviation === "TB");
                    const opponent = lastGame.competitions[0].competitors.find(team => team.team.abbreviation !== "TB");
                    const outcome = tampaBayL.winner ? "won" : "lost";
                    const lightScore = tampaBayL.score.value;
                    const oppScore = opponent.score.value;
                    resultElement.innerHTML += `<br> The Tampa Bay Lightning <span style="color: ${tampaBayL.winner ? 'green' : 'red'};">${outcome}</span> against the ${opponent.team.displayName} yesterday!<br> Final Score: ${lightScore} - ${oppScore} <br> The next game the Lightning play will be ${nextGame.date} <br>`;
                } else {
                    resultElement.textContent += "The Tampa Bay Lightning did not play yesterday.";
                }
            } else {
                resultElement.textContent += "No recent game information available.";
            }
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            resultElement.textContent += "Unable to retrieve game information.";
        });

    // Orlando Magic games
    fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/orl/schedule")
        .then(response => response.json())
        .then(data => {
            const gamesB = data.events;
            const now = new Date();
            const gamesPastB = gamesB.filter(game => new Date(game.date) < now);
            const upcomingGamesB = gamesB.filter(game => new Date(game.date) > now);
            if (gamesPastB.length > 0) {
                const lastGameB = gamesPastB[gamesPastB.length - 1];
                const lastGameDateB = new Date(lastGameB.date);
                const estOffset = 5 * 60 * 60 * 1000; // EST is UTC-5
                const lastGameDateBEST = new Date(lastGameDateB.getTime() - estOffset);
                const yesterdayBEST = new Date();
                yesterdayBEST.setDate(yesterdayBEST.getDate() - 1);
                yesterdayBEST.setHours(0, 0, 0, 0);
                const nextGameB = upcomingGamesB[0];
                if (lastGameDateBEST.toDateString() === yesterdayBEST.toDateString()) {
                    const orlandoMagic = lastGameB.competitions[0].competitors.find(team => team.team.abbreviation === "ORL");
                    const opponent = lastGameB.competitions[0].competitors.find(team => team.team.abbreviation !== "ORL");
                    const outcomeB = orlandoMagic.winner ? "won" : "lost";
                    const magScore = orlandoMagic.score.value;
                    const oppScoreB = opponent.score.value;
                    resultElement.innerHTML += `<br> The Orlando Magic <span style="color: ${orlandoMagic.winner ? 'green' : 'red'};">${outcomeB}</span> against the ${opponent.team.displayName} yesterday!<br> Final Score: ${magScore} - ${oppScoreB} <br> The next game the Magic play will be ${nextGameB.date} <br>`;
                    if (outcomeB == "won") {
                        resultElement.innerHTML += `<br> There is Pizza tonight! <br>`;
                    }
                } else {
                    resultElement.textContent += "The Orlando Magic did not play yesterday.";
                }
            } else {
                resultElement.textContent += "No recent game information available.";
            }
        })
        .catch(error => {
            console.error("Error fetching data:", error);
            resultElement.textContent += "Unable to retrieve game information.";
        });
});
