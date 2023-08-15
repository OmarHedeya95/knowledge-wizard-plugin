# import the library
from bs4 import BeautifulSoup
import json
import requests
import asyncio
import os
from langchain.chat_models import ChatOpenAI
from langchain.schema import (
    AIMessage,
    HumanMessage,
    SystemMessage
)

from langchain.text_splitter import CharacterTextSplitter, TokenTextSplitter
from pprint import pprint
import regex as re

from langchain.text_splitter import NLTKTextSplitter

from langchain import LLMChain

from langchain import PromptTemplate
from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    AIMessagePromptTemplate,
    HumanMessagePromptTemplate,
)

import sys




verbosity = False

url = sys.argv[1]
key = sys.argv[2]
links_num = int(sys.argv[3])
os.environ["OPENAI_API_KEY"] =  key



def get_links(url):
    # get the web page content
    response = requests.get(url)
    html = response.text

    # create a BeautifulSoup object
    soup = BeautifulSoup(html, "html.parser")

    # find all anchor tags with href attribute
    links = soup.find_all("a", href=True)
    text = soup.get_text()
    return links, text

def get_absolute_links(url: str, links: list):
    urls = {}
    ignore_links = ["twitter.com", "discord.com", "career", "youtube", "job", "vimeo", "linkedin", "slack.com", "typeform.com", "tiktok.com", "facebook.com"]
    #to avoid cases where the homepage is not included as a link
    links.append({"href": url})
    for link in links:
        if '#' not in link["href"]:
            absolute_link = link["href"]
            if 'http' not in absolute_link:
                absolute_link = url + '/' + absolute_link
            
            # remove double // if it is not preceeded by https: and / at the end of the link
            absolute_link = re.sub(r"(?<!https:|http:)/+", '/', absolute_link)
            absolute_link = re.sub(r"/$", '', absolute_link)

            if any(substring in absolute_link for substring in ignore_links):
                #We still record the link but we do not read it
                urls[absolute_link] = False
            else:
                urls[absolute_link] = True
    
    # Just to have a list of the links to be read later
    if verbosity:
        for url, to_read in urls.items():
            if to_read:
                print(url)

        print('\n\n')
    
    return urls

async def async_generate(chain, paragraphs):
    resp = await chain.arun(paragraphs=paragraphs)
    #print(resp)
    return resp

def clean_text(text):
    text = text.strip()
    
    text = re.sub(r"\n+", '\\n\\n', text)
    text = re.sub(r" +", " ", text) 
    return text

def chunk_text(text):
    #?text_splitter = CharacterTextSplitter.from_tiktoken_encoder(encoding_name = "gpt2", chunk_size = 2048, chunk_overlap = 0)
    text_splitter = TokenTextSplitter.from_tiktoken_encoder(encoding_name = "gpt2", chunk_size = 2048, chunk_overlap = 0)
    #text_splitter = NLTKTextSplitter(chunk_size=2048)

    chunks = text_splitter.split_text(text)
    return chunks

def prepare_summarization_requests(text: str):
    # divide the text into chunks that get sent separately to the LLM to avoid token limit error
    chunks = chunk_text(text)
    messages = []
    for chunk in chunks:
        message = [HumanMessage(content= f"Summarize the following text: {chunk}")]
        messages.append(message)

    return messages

async def send_chat_requests_in_parallel(chat_model: ChatOpenAI, messages: list):
    results = []
    #? To summarize the chunks in parallel
    resp = await chat_model.agenerate(messages)
    for generation in resp.generations:
        results.append(generation[0].text)
    
    return results

async def analyze_startup_from_summaries(chat_model: ChatOpenAI, paragraph_groups: list):
    """_summary_

    Args:
        chat_model (ChatOpenAI): an OpenAI chat bot 
        paragraph_groups (list): list of groups of paragraphs (chunked to avoid token limit) to be fed to the chat bot to create analysis for the startup
    """
    human_request_template = "Given the following paragraphs about a startup:\n\n{paragraphs}\n\nPlease provide a detailed analysis of the startup. You are smart assistant who always sticks to the facts and depends only on information in the paragraphs. If information is missing, you always say 'No Information'. Your analysis should be divided in the following subsections:\n\
- Problem to be solved: <problem the startup is solving in bullet points>\n\
- Product: <detailed description products of the startup and how it solves the problem in bullet points>\n\
- Features: <detailed description of the features of the products in bullet points>\n\
- Business Model: <ONLY IF PRICING OR BUSINESS MODEL IS EXPLICITLY MENTIONED. Otherwise say 'No Information'>\n\
- Competition: <detailed overview of the competitors to the startup in bullet points>\n\
- Vision: <vision of the startup in bullet points>\n\
- Extras: <additional note-worthy information in bullet points. Add as many points as possible>"
    human_message_prompt = HumanMessagePromptTemplate.from_template(human_request_template)
    chat_prompt = ChatPromptTemplate.from_messages([human_message_prompt])
    
    paragrah_to_summary_chain = LLMChain(llm=chat_model, prompt=chat_prompt, verbose=verbosity)
    

    # Generate anaylsis for the startup from different paragraphs parallely (we get back different summaries each based on the paragraphs it let)
    tasks = [async_generate(paragrah_to_summary_chain, paragraphs) for paragraphs in paragraph_groups]
    results = await asyncio.gather(*tasks)


    # We then get each summary and progressively improve our overall summarization of the startup
    system_prompt_template = "You are a tech journalist with a keen eye for details. You will first read a summary of a startup then follow-up information about the startup. Your task is to enrich the startup summary with helpful information from the follow-up. Include as much information as possible in the enriched summary. The enriched summary must always have the same format as the original summary (also in bullet points)."
    system_prompt = SystemMessagePromptTemplate.from_template(system_prompt_template)
    human_request_template = "## Summary:\n{summary}\n\n## Follow up:\n{follow_up}"
    human_prompt = HumanMessagePromptTemplate.from_template(human_request_template)
    chat_prompt = ChatPromptTemplate.from_messages([system_prompt, human_prompt])

    summary_enrich_chain = LLMChain(llm=chat_model, prompt=chat_prompt, verbose=verbosity)

    summary = results[0]
    for follow_up in results[1:]:
        # Enrich the first analysis of the startup by subsequent summaries
        resp = summary_enrich_chain.run(summary=summary, follow_up=follow_up)
        resp = 'Problem to be solved:\n' + resp.split('Problem to be solved:')[1].strip()
        summary = resp
    
    return summary

async def main(url):
    #url =  #"https://ixana.ai"
    links, text = get_links(url)
    absolute_sub_urls = get_absolute_links(url, links)
    chat = ChatOpenAI(model_name = "gpt-3.5-turbo", temperature=0.3, max_tokens=1024)
    
    i = 0
    messages = []
    for sub_url, to_check in absolute_sub_urls.items():
        # Read text from the top 6 links on the homepage, prepare a summarization request for each of them
        if i >= links_num:
            break
        if to_check:
            _, text = get_links(sub_url)
            
            text = clean_text(text)
        

            messages.extend(prepare_summarization_requests(text))

            i+=1


    # get the summaries of the top n links on the home page in parallel
    summaries = await send_chat_requests_in_parallel(chat_model=chat, messages=messages)
    
    # Join the summaries together in one "prompt"
    paragraphs = "\n\n".join(summaries)
    paragraph_groups = chunk_text(paragraphs)


    summary = await analyze_startup_from_summaries(chat_model=chat, paragraph_groups=paragraph_groups)

    
    #todo print(summary)

    return summary


url = 'https://' + url
summary = asyncio.run(main(url))

reply = {}
reply['summary'] = summary
print(json.dumps(reply))