import requests
from datetime import datetime, timedelta

def get_tijuana_flats_deal_status():
    api_url = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams/tb/schedule"
    try:
        response = requests.get(api_url, verify=False)
        data = response.json()
        games = data.get("events", [])
        now = datetime.utcnow()
        latest_game = None

        # Find most recent regular season home game
        for g in reversed(games):
            competitions = g.get("competitions", [{}])
            competitors = competitions[0].get("competitors", [{}])
            is_home = competitors[0].get("homeAway") == "home"
            is_regular = g.get("season", {}).get("type") == 2
            is_final = g.get("status", {}).get("type", {}).get("completed", False)
            if is_home and is_regular and is_final:
                latest_game = g
                break

        if not latest_game:
            return "offseason"

        game_date = datetime.strptime(latest_game["date"], "%Y-%m-%dT%H:%MZ")
        days_since = (now - game_date).days
        if days_since > 7:
            return "offseason"

        # Check Rays pitcher strikeouts
        stats = None
        for c in latest_game["competitions"][0]["competitors"]:
            if c.get("team", {}).get("abbreviation") == "TB":
                stats = c.get("statistics", [])
                break

        strikeouts = 0
        if stats:
            for s in stats:
                if s.get("name") == "pitching":
                    for stat in s.get("stats", []):
                        if stat.get("name") == "strikeouts":
                            strikeouts = int(stat.get("value", 0))
        if strikeouts >= 10 and days_since <= 5:
            return "active"
        return "not active"
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    status = get_tijuana_flats_deal_status()
    print("Tijuana Flats Taco & Chips deal status:", status)