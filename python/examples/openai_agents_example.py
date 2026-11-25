import os
from uk_drops_feed import UKDropsFeedClient
from uk_drops_feed.openai_agents import get_openai_agents_tools
# Requires: pip install "uk-drops-feed[openai-agents]"

client = UKDropsFeedClient(
    trial_key=os.environ.get("UKDF_TRIAL_KEY"),
    auto_trial=not os.environ.get("UKDF_TRIAL_KEY"),
    trial_ref="openai-agents-py",
)
tools = get_openai_agents_tools(client)
print("Loaded OpenAI Agents tools:", len(tools))
