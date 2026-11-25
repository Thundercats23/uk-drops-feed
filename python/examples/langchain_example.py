import os
from uk_drops_feed import UKDropsFeedClient
from uk_drops_feed.langchain import get_langchain_tools
# Requires: pip install "uk-drops-feed[langchain]"

client = UKDropsFeedClient(
    trial_key=os.environ.get("UKDF_TRIAL_KEY"),
    auto_trial=not os.environ.get("UKDF_TRIAL_KEY"),
    trial_ref="langchain-py",
)
tools = get_langchain_tools(client)
print("Loaded LangChain tools:", [t.name for t in tools])
