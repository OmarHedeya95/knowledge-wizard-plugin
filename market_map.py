import asyncio
from pprint import pprint
from utils import bing_chat_search
import sys
import json

industry = sys.argv[1]
plugin_path = sys.argv[2]

prompt_base = "A market map is a visual representation of the competitive landscape of an industry or sector. It shows the key players, segments, features needed for each segment, and trends in a given market. Please create a table depicting the market map for the "

#!Do not make up facts and always correctly attribute the source of information. -> too restrictive? remove??
prompt = prompt_base + industry + ' industry. Be as detail oriented as possible and cover as many segments as you can. Do not make up facts and always correctly attribute the source of information. Think step by step.' 
reply, source = asyncio.run(bing_chat_search(prompt, plugin_path))
replies = {}
replies[f'prompt_1'] = {'text': reply, 'sources': source}
print(json.dumps(replies))

