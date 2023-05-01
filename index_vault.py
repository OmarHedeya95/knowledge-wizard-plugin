from utils import add_texts_to_pinecone, init_and_load_pinecone, enrich_file_with_hashtags
from tqdm import tqdm
import sys 
import json
import pinecone
from utils import delete_doc_from_pinecone
from utils import read_file_and_split_text


#--------------
json_path = sys.argv[1]  
key =  sys.argv[2]         
plugin_path = sys.argv[3]
pinecone_key = sys.argv[4]
pinecone_index_name = sys.argv[5]
pinecone_env_name = sys.argv[6]
#------------------



def index_vault_pinecone(index: pinecone.index.Index, index_name: str, files: dict, openai_key: str):
    print("--Embedding Files--")
    counter = 0
    count_added_files = 0
    for file_name, value in tqdm(files.items()):
        embedded_note = None
        file_path = value['full_path']
        is_modified = value['change_type']
        if '.canvas' not in file_name.lower():
            if is_modified == "deleted":
                #If target is just to delete a note from knowledge base
                delete_doc_from_pinecone(index, file_name)
            #todo differentiate between the two cases?
            if is_modified == 'new' or is_modified == 'modified':
                delete_doc_from_pinecone(index, file_name)
                try:
                    texts, filter, text_original = read_file_and_split_text(file_path)
                except Exception as e:
                    print(f'File: {file_name} could not be read')
                    continue

                if "Hashtags:" not in text_original:
                    #Enrich only if the file has not been already enriched before
                    enrich_file_with_hashtags(texts, text_original, file_path, openai_key=openai_key)    
                
                add_texts_to_pinecone(index_name, texts, file_name, filter, key)
            

files = []
with open(json_path, 'r') as f:
    files = json.load(f)

openai_key = key
index, docsearch = init_and_load_pinecone(pinecone_index_name, openai_key, pinecone_key, pinecone_env_name)


index_vault_pinecone(index, pinecone_index_name, files, openai_key) 