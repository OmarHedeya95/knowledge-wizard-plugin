# Explanation
This is an obsidian plugin that does 2 things:

1. It makes all your notes semantically searchable; you can simply highlight any text in your notes (or write new text for that matter) and with a click of a button get all ideas (paragraphs) that are similar to this thought you have just highlighted (through the indexing and re-indexing of new files functionality)

2. It adds hashtags to every paragraph in your notes, to help you see hidden connections between your notes. Before generating hashtags the AI asks itself the following questions:
   - How can the user use this information in the future?
   - What are the relevant industries or sectors of the economy for this paragraph?
   - What are the lifeskills that the human can learn from this paragraph?
   - Are there any locations that were mentioned in the paragraph? (To help you connect ideas geographically as well)

The hashtags that will be generated then will have the following formats usually: `#Industry/<relevant-industry>` or `#LifeSkills/<relevant-skill>` or `#Geo/<relevant-geo>` 

The plugin is powered by GPT-4, Langchain, and Pinecone.

# Setup Steps
- Clone this repo into `<obsidian-vault-path>/.obsidian/plugins/knowledge-wizard/`
- cd into the folder knowledge-wizard
- Run `npm i`
- Run `npm run dev` to finish building the plugin


## Creating Python Virtual Environment
I will use conda here. Follow the following steps in the terminal (first cd to the Knowledge Wizard plugin folder)
- Install conda on your machine
- `conda create --name <ENV-NAME> python=3.8.13`
- `pip install -r requirements.txt`
- To use the idea similarity function, you need the AdvancedURI Plugin installed
## Settings
- `Obsidian Vault Path`: Do not forget to add '/' at the end of the path e.g: <vault-path>/
- `Python Virtual Environment Path`: e.g: /Users/<user-name>/opt/anaconda3/envs/<env-name>/bin/python
- `Pinecone Index Name`: The name of the pinecone index you created

Other settings are self-explanatory

# Usage
- `Cmd + P` -> either index, re-index new files, find similar ideas, or add hashtags
- To find similar ideas, you will need to highlight a piece of text first -> Cmd + P -> find similar ideas -> on the right hand side you will see a window with different ideas that are somehow similar to the piece of text you highlighted
- Hashtags are added after each paragraph in text. You can add hashtags manually by adding `#AddHashtags`to the file or when you re-index new files, each file get the hashtags after it is indexed
- go over the files with `#review_hashtags` to review the hashtags in the file

