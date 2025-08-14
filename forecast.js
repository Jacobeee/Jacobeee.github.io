// forecast.js - NBA pizza forecast for index2.html

document.addEventListener("DOMContentLoaded", () => {
    console.log("7-Day Forecast Loaded");

    // Forecast today
    let today_forecast = false;
    fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/orl/schedule")
    .then(response => response.json())
    .then(data => {
        const games = data.events;
        const now = new Date();
        const gamesPast = games.filter(game => new Date(game.date) < now);

        if (gamesPast.length > 0) {
        const lastGame = gamesPast[gamesPast.length - 1];
        const lastGameDate = new Date(lastGame.date);
        const estOffset = 5 * 60 * 60 * 1000; // EST is UTC-5
        const lastGameDateEST = new Date(lastGameDate.getTime() - estOffset);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0); // Normalize to midnight

        if (lastGameDateEST.toDateString() === yesterday.toDateString()) {
            const orlandoMagic = lastGame.competitions[0].competitors.find(
            team => team.team.abbreviation === "ORL"
            );
            if (orlandoMagic.winner) {
                today_forecast = true;
                document.getElementById("iconDay1").src = "pizza.jpg";
                document.getElementById("chanceDay1").innerHTML = "100%";
            }
        }
        }
    })

    if (!today_forecast) {
        document.getElementById("iconDay1").src = "sad.png";
        document.getElementById("chanceDay1").innerHTML = "0%";
    }

    // Forecast tomorrow
    let tomorrow_forecast = false;
    fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/orl/schedule")
    .then(response => response.json())
    .then(data => {
        const games = data.events;
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to midnight

        // Check if there is a game today
        const gameToday = games.some(game => {
        const gameDate = new Date(game.date);
        const gameDateEST = new Date(gameDate.getTime() - (5 * 60 * 60 * 1000)); // Convert to EST
        return gameDateEST.toDateString() === today.toDateString();
        });

        if (gameToday) {
            tomorrow_forecast = true;
            document.getElementById("iconDay2").src = "pizza.jpg";
            document.getElementById("chanceDay2").innerHTML = "100%";
        }
    })

    if (!tomorrow_forecast) {
        document.getElementById("iconDay2").src = "sad.png";
        document.getElementById("chanceDay2").innerHTML = "0%";
    }

    // Forecast future
    async function checkMagicGameInFuture(offsetDays, i) {
        let forecast = false;
        const response = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/orl/schedule");
        const data = await response.json();
        const games = data.events;
        const now = new Date();
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + offsetDays);
        targetDate.setHours(0, 0, 0, 0);
        const gameOnTargetDate = games.some(game => {
            const gameDate = new Date(game.date);
            const gameDateEST = new Date(gameDate.getTime() - (5 * 60 * 60 * 1000));
            return gameDateEST.toDateString() === targetDate.toDateString();
        });
        if (gameOnTargetDate) {
            forecast = true;
            document.getElementById("iconDay" + i).src = "pizza.jpg";
            document.getElementById("chanceDay" + i).innerHTML = "50%";
        } else {
            document.getElementById("iconDay" + i).src = "sad.png";
            document.getElementById("chanceDay" + i).innerHTML = "0%";
        }
        return forecast;
    }

    for (var i = 1; i <= 6; i++) {
        checkMagicGameInFuture(i, i+2);
    }
});
