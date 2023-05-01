# Setup Steps
- Clone this repo into `<obsidian-vault-path>/.obsidian/plugins/vc_wizard/`
## Creating Python Virtual Environment
I will use conda here. Follow the following steps in the terminal (first cd to the Knowledge Wizard plugin folder)
- `conda env create -f ./environment.yml`
- `conda activate <env-name>``
- `which python` -> copy the path and paste it into the correct setting of the plugin
- To use the idea similarity function, you need the AdvancedURI Plugin installed
## Settings
- The Affinity settings are only needed if you are using Affinity as CRM and would like to automatically push startups there. If you are just using it for summarization and cleaning it from markdown syntax, just fill the other settings
- Do not forget to have a '/' at the end of the vault path (otherwise it won't work)

# Usage
- After the call, add the correct hashtags to the note
	- For a VC -> #network/connected  and type of VC ( #Person/VC or #Entity/VC )
	- For startup -> #startups/screened 
- To summarize:
	- For a startup -> use the mouse to highlight the text you want to summarize -> `Cmd + P` -> summarize this startup
	- For a VC -> `Cmd + P` -> Summarize All VC Notes
- Check the #review and #review_startup hashtags
- Approve that everything is fine or make your changes to the summary
- Remove the #review (or #review_startup ) hashtag and add ( #Affinity ) instead
- `Cmd + P` -> Push VCs or Startups to Affinity
- Voila, data is pushed to Affinity ( the affinity hashtag will be removed automatically)