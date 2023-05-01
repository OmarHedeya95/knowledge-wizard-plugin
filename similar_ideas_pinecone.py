import openai
import sys
from utils import init_and_load_pinecone
import json

text = sys.argv[1]
key =  sys.argv[2]
vault_path = sys.argv[3]
pinecone_key = sys.argv[4]
pinecone_index_name = sys.argv[5]
pinecone_env_name = sys.argv[6]
openai.api_key = key
openai_key = key

index, docsearch = init_and_load_pinecone(pinecone_index_name, openai_key, pinecone_key, pinecone_env_name)

#todo filter to avoid getting matches with itself
docs = docsearch.similarity_search(query=text, k=15)

results = {}

for i, doc in enumerate(docs, 1):

    note_title = doc.metadata['source']
    #todo What to do when multiple paragraphs come from the same doc?
    if (results.get(note_title, None)):
        results[note_title + f'***{i}'] = doc.page_content
    else:
        results[note_title] = doc.page_content

print(json.dumps(results))