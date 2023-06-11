from utils import add_texts_to_pinecone, init_and_load_pinecone, enrich_file_with_hashtags
from tqdm import tqdm
import sys 
import json
import pinecone
from utils import delete_doc_from_pinecone
from utils import read_file_and_split_text

file_path_to_index = sys.argv[1]  
key =  sys.argv[2]         
plugin_path = sys.argv[3]
pinecone_key = sys.argv[4]
pinecone_index_name = sys.argv[5]
pinecone_env_name = sys.argv[6]
modification_type = sys.argv[7]
file_name = sys.argv[8]

openai_key = key


if '.canvas' not in file_name.lower():
    index, docsearch = init_and_load_pinecone(pinecone_index_name, openai_key, pinecone_key, pinecone_env_name)


    delete_doc_from_pinecone(index, file_name)

    if modification_type == "new" or modification_type == "modified":
        text_original = ''
        texts = []
        filter = {}
        try:
            texts, filter, text_original = read_file_and_split_text(file_path_to_index)
        except Exception as e:
            print(f'File: {file_name} could not be read')
            print (e)
            #! return

        if "Hashtags:" not in text_original:
        #Enrich only if the file has not been already enriched before
            enrich_file_with_hashtags(texts, text_original, file_path_to_index, openai_key=openai_key)    

        add_texts_to_pinecone(pinecone_index_name, texts, file_name, filter, key)