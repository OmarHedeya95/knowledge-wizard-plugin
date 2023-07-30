import asyncio
from pprint import pprint
from utils import market_research
import sys

industry = sys.argv[1]
plugin_path = sys.argv[2]

asyncio.run(market_research(industry, plugin_path))


