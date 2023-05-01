from utils import enrich_files
import sys
import openai

file_path = sys.argv[1]
key = sys.argv[2]
openai.api_key = key

try:
    enrich_files([file_path], key)
except Exception as e:
    pass
