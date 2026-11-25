import os
from uk_drops_feed import UKDropsFeedClient

client = UKDropsFeedClient(
    trial_key=os.environ.get("UKDF_TRIAL_KEY"),
    credit_token=os.environ.get("UKDF_CREDIT_TOKEN"),
    auto_trial=not (
        os.environ.get("UKDF_TRIAL_KEY")
        or os.environ.get("UKDF_CREDIT_TOKEN")
        or os.environ.get("EVM_PRIVATE_KEY")
    ),
    trial_ref="python-example",
    evm_private_key=os.environ.get("EVM_PRIVATE_KEY"),
)

teaser = client.teaser("UK")
print("Free teaser drops:", len(teaser.get("drops", [])))

upcoming = client.upcoming(franchise="pokemon-tcg", days=60, limit=5)
print("Upcoming Pokemon TCG drops:", upcoming.get("count", len(upcoming.get("drops", []))))
