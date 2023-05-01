import re
import json
import os
from langchain.text_splitter import CharacterTextSplitter
import pinecone
from langchain.vectorstores import Pinecone
from langchain.embeddings.openai import OpenAIEmbeddings

from langchain.chat_models import ChatOpenAI
from langchain.schema import (
    AIMessage,
    HumanMessage,
    SystemMessage
)



'''Pinecone Methods'''
def init_and_load_pinecone(index_name: str, openai_key: str, pinecone_key: str, pinecone_env_name: str):
    """Method that initialize and loads pinecone vector database. It returns both the direct pinecone index from the cloud as well as the langchain wrapper

    Args:
        index_name (str): name of the index on the cloud of Pinecone

    Returns:
        index: the direct index from the pinecone cloud (used for delete operation and co)
        docsearch: the pinecone langchain wrapper (used for similarity search and co)
    """
    os.environ["OPENAI_API_KEY"] = openai_key
    pinecone.init(api_key= pinecone_key, environment=pinecone_env_name) 
    indices = pinecone.list_indexes()
    if index_name not in indices:
        #todo dimension = 1536 because we use OpenAI, maybe want to make this more generalizable
        pinecone.create_index(index_name, dimension=1536)
    embeddings = OpenAIEmbeddings()    
    index = pinecone.Index(index_name)
    docsearch = Pinecone.from_existing_index(index_name, embeddings)
    return index, docsearch

def delete_doc_from_pinecone(index:pinecone.index.Index, document_name: str):
    """Deletes all the paragraphs from the document_name in the database

    Args:
        index (pinecone.index.Index): _description_
        document_name (str): _description_
    """

    index.delete(
        filter={
                "source": {"$eq": document_name}
        }
    )

def add_texts_to_pinecone(index_name: str, texts: list, title: str, filter : dict, openai_key: str):
    """Add paragraphs (texts) from the note with title (title) to the pinecone vector db

    Args:
        docsearch (Pinecone): _description_
        texts (list): _description_
        title (str): _description_
    """
    os.environ["OPENAI_API_KEY"] = openai_key
    source = {"source": title}
    if len(filter.keys()) > 0:
        for key in filter.keys():
            source[key] = filter[key]

    metas = [source.copy() for _ in range(len(texts))]
    embeddings = OpenAIEmbeddings()
    Pinecone.from_texts(texts=texts, embedding=embeddings, index_name=index_name, metadatas=metas)

'''Hashtag Methods'''
def add_hashtags_gpt4(chunks:list, openai_key: str):
    hashtag_list = []
    ai_comment = ''
    hashtags = ''
    os.environ["OPENAI_API_KEY"] = openai_key
    chat = ChatOpenAI(model_name = "gpt-4", temperature=0.3)
    for chunk in chunks:
        # We add hashtags only to chunks that does not have hashtags already
        #print(chunk)
        if "Hashtags:" not in chunk:
            #print("-----------------------------")
            #print("Hashtags not found in this paragraph")
            messages = [
                        SystemMessage(
                        content="You are a helpful research assistant whose main task is to read a piece of text and figure out in what context this text will be useful for a human. Then, you should generate hashtags that are most suitable to the given text such that the human can easily find the right information at the right time.\n\
        1. You should think about when would the user need this piece of text.\n\
        2. You should think about what industries or sectors of the economy are relevant to the text\n\
        3. You should think about what locations were mentioned in the text.\n\
        4. You should think about what life skills can the user learn from this text.\n\
        Try to generate hashtags in the following formats:\n\
        - #Industry/<industry-name>\n\
        - #Geo/<location>\n\
        - #LifeSkills/<skill>\n\
        Please generate hashtags for ALL relevant industries you could think of\n\
        Let's think step by step. "
        ),

                        HumanMessage(
                                    content="\"Many other industries have adopted automation and software-driven technologies,\" Ellis said. \"That's really all I see 3D-printing as being. It's really just an automation technology that merges many, many parts together. So our goal is to have 100 times fewer parts for rockets.\"\n\
        - Note: The main advantage of 3DPrinting in Space is that it reduced the amount of parts than need to be produced and assembled by orders of magnitude.\n\
        Relativity Space can print big sections of a rocket all as one piece unlike the incumbents like SpaceX that can only 3D print small parts."
                        ),

                        AIMessage(
                                    content="1. The user might need this piece of text when researching 3D printing, space technology, or advancements in rocket manufacturing.\n\
2. Relevant industries or sectors include aerospace, manufacturing, and 3D printing.\n\
3. No specific locations are mentioned in the text.\n\
4. Life skills that can be learned from this text include innovation, problem-solving, and understanding the benefits of automation.\n\
- Hashtags:\n\
    - #Industry/3DPrinting, #Industry/Space, #Industry/Rockets, #Industry/Aerospace, #Industry/Manufacturing, #LifeSkills/Innovation, #LifeSkills/ProblemSolving, #LifeSkills/AutomationBenefits"
                        ),

                        HumanMessage(
                                    content = chunk
                        ) 
            ]

            ai_comment = chat(messages).content
            #print(ai_comment)
            try:
                hashtags = ai_comment.split('Hashtags:')[1]
            except:
                #print("No Hashtags Found")
                #print(ai_comment)
                hashtags = ''
            
    
        hashtag_list.append(hashtags)
        hashtags = ''
    
    return hashtag_list

def enrich_file_with_hashtags(chunks, text_original: str, file_path: str, openai_key: str):
    """This file gets hashtags for every paragraph that is to be indexed (chunks created by tiktoken) and then adds them to the file in the correct place

    Args:
        texts (list [str]): chunks of paragraphs to be indexed created by tiktoken
        text_original (str): the original text of the file before chunking
        file_path (str): file path
    """
    hashtags: list[str] = add_hashtags_gpt4(chunks, openai_key=openai_key)
    if len(hashtags) > 0:
        original_paragraphs = text_original.split('\n\n')
        file_path_to_update = file_path
        updated_text = ''
        with open(file_path_to_update, 'w+') as f:
            for indexed_text, hashtag in zip(chunks, hashtags):
                # We only care if the chunk we are looking at has generated hashtags
                if len(hashtag) > 0:
                    index = indexed_text.find('- Tags:') #todo ONLY IF IT IS A READWISE File
                    if index != -1:
                        # In case we are reading a paragraph from Readwise file, we would like to generate hashtags for the paragraph itself and not the tags we used
                        start_index = indexed_text.find('-', index)
                        indexed_text = indexed_text[start_index:]
                    
                    words = indexed_text.split(' ')
                    first_words = words[:5]
                    first_sentence = ''
                    for word in first_words:
                        first_sentence += word + ' '

                    for i, original_paragraph in enumerate(original_paragraphs, 0):
                        # We search for the paragraph in the file that actually matches the chunk we are using to generate hashtags
                        if first_sentence in original_paragraph:
                            if len(hashtag) > 0:
                                original_paragraph = original_paragraph + '\n- Hashtags:\n\t' + hashtag.lstrip() + '\n\n'
                                original_paragraphs[i] = original_paragraph
                            break

            for original_paragraph in original_paragraphs:
                updated_text += original_paragraph + '\n'
                
            #updated_text = updated_text.replace("#AddHashtags", "")
            updated_text = updated_text + '#review_hashtags'
            f.write(updated_text)
            
        #return updated_text

def enrich_files(file_paths: list, openai_key: str):
    for file_path in file_paths:
        chunks, filter, text_original = read_file_and_split_text(file_path)

        #---------UPDATE FILES WITH NEW HASHTAGS-----------
        updated_file_content = enrich_file_with_hashtags(chunks, text_original, file_path, openai_key=openai_key)
        return updated_file_content

'''Text Helper Methods'''
def read_file_and_split_text(file_path: str):
    text_splitter = CharacterTextSplitter.from_tiktoken_encoder(encoding_name = "gpt2", chunk_size = 100, chunk_overlap = 0)
    text = ''
    text_original = ''
    filter = {}
    with open (file_path) as f:
        text = f.read()
        text = text.replace('#AddHashtags', '')
        text_original = text
        pattern = r'# Stop Indexing'
        text = re.split(pattern, text)[0]

        # Define a regex pattern to match markdown image syntax
        pattern = r"!\[.*?\]\(.*?\)"
        text = re.sub(pattern, "", text)

        pattern = r"\(\[View Highlight.*"
        text = re.sub(pattern, "", text)

        pattern = r"\(\[Location.*"
        text = re.sub(pattern, "", text)

        pattern = r"\(\[View Tweet.*"
        text = re.sub(pattern, "", text)

        
        # Regex to match links and replace them
        pattern = r"https?://.*[\r]*"
        text = re.sub(pattern, "", text)
        

    if '#startups' in text or '#startup' in text:
        filter["type"] = 'company'
    chunks = text_splitter.split_text(text)
    return chunks, filter, text_original

def save_json_line(filename: str, my_dict:dict):
    with open(filename, 'a') as f:
        json.dump(my_dict, f)
        f.write('\n')

def remove_double_space(s):
    pattern = r"  +"
    result = re.sub(pattern, " ", s)
    return result

def is_file_empty(filename):
  # Check if the file exists
  if not os.path.exists(filename):
    raise FileNotFoundError(f"File '{filename}' does not exist.")

  # Check if the file is empty
  return os.stat(filename).st_size == 0

'''Json Helper Methods'''
def save_json(filename: str, my_dict: dict):
    with open(filename, "w") as f:
        json.dump(my_dict, f)

def load_json(filename: str):
    my_dict = {}
    # Load a dictionary from a JSON file
    if not is_file_empty(filename):
        with open(filename, "r") as f:
            my_dict = json.load(f)
    return my_dict

