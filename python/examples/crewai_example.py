import os
from uk_drops_feed import UKDropsFeedClient
from uk_drops_feed.crewai import get_crewai_tools
# Requires: pip install "uk-drops-feed[crewai]"

client = UKDropsFeedClient(
    trial_key=os.environ.get("UKDF_TRIAL_KEY"),
    auto_trial=not os.environ.get("UKDF_TRIAL_KEY"),
    trial_ref="crewai-py",
)
tools = get_crewai_tools(client)
print("Loaded CrewAI tools:", [t.name for t in tools])
