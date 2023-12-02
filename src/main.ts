import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  Menu,
  MenuItem,
  MarkdownFileInfo,
  TFile,
  TAbstractFile,
  request,
  moment,
} from "obsidian";
import { WizardView, WIZARD_VIEW } from "view";
import { TextInputModal } from "modal";
import * as fs from "fs";
//import {fs} from 'fs'
//import { execSync } from 'child_process';
const { Configuration, OpenAIApi } = require("openai");

let pythonPath = "";
let scriptPath_AI = "";
let openaiAPIKey = "";
let pineconeAPIKey = "";
let pineconeIndexName = "";
let pineconeEnvName = "us-east1-gcp";

async function launch_python(
  pythonPath: string,
  scriptPath: string,
  scriptName: string,
  args: any
) {
  /**
   * This function launches a python script with the correct python virtual environment and returns whatever the python script prints!! (no value passing, take care)
   */
  let { PythonShell } = require("python-shell");
  const options = {
    mode: "text",
    pythonPath: pythonPath,
    scriptPath: scriptPath,
    args: args,
  };
  const result = await new Promise((resolve, reject) => {
    PythonShell.run(scriptName, options, function (err: Error, results: any) {
      if (err) throw err;
      return resolve(results);
    });
  });

  return result;
}

function file_ready_for_hashtags(file_content: string) {
  return file_content.includes("#AddHashtags");
}

async function hashtag_generator(file_path: string, scriptName: string) {
  const scriptPath = scriptPath_AI;

  var args = [file_path, openaiAPIKey];

  const response = await launch_python(
    pythonPath,
    scriptPath,
    scriptName,
    args
  );

  console.log(response);
  return response;
}

function save_json(file_path: string, content: any) {
  const jsonString = JSON.stringify(content);
  fs.writeFile(file_path, jsonString, (err) => {
    if (err) {
      console.error(`Error saving the file: ${err}`);
      return;
    }
    console.log("File has been created");
  });
}

function append_to_json(file_path: string, key: any, value: any) {
  fs.readFile(file_path, (err, data: any) => {
    if (err) {
      throw err;
    }

    let oldData;
    try {
      oldData = JSON.parse(data);
    } catch (e) {
      // If the file is empty, data will be an empty string,
      // which will cause JSON.parse() to throw an error.
      // In this case, we set oldData to an empty object.
      oldData = {};
    }
    oldData[key] = value; //{'change_type': FileType.modified, 'full_path': file_path}
    const updatedJson = JSON.stringify(oldData);
    fs.writeFile(file_path, updatedJson, (err) => {
      if (err) throw err;
      //console.log('Data appended to file')
    });
  });
}

enum FileType {
  modified = "modified",
  deleted = "deleted",
  new = "new",
}

export default class VCWizardPlugin extends Plugin {
  settings: ButlerSettings;
  status: HTMLElement;

  async onload() {
    await this.loadSettings();
    this.status = this.addStatusBarItem();

    this.registerView(WIZARD_VIEW, (leaf) => new WizardView(leaf));
    this.app.workspace.onLayoutReady(() => {
      this.activateView();
      this.updateView([]);
    });

    this.status.setText("🧙: Knowledge Wizard is loading...");
    this.status.setAttr("title", "Wizard is loading....");

    this.addCommand({
      id: "index-vault",
      name: "Index Vault",
      callback: () => this.index_vault(),
    });
    this.addCommand({
      id: "index-changed-files",
      name: "Reindex New/Changed Files Only",
      callback: () => this.index_new_and_modified_files(),
    });
    this.addCommand({
      id: "find-similar-ideas",
      name: "Find Similar Ideas",
      editorCallback: (editor, view) => this.find_similar_ideas(editor, view),
    });
    this.addCommand({
      id: "hashtag-generator",
      name: "Add Hashtags to #AddHashtags Files",
      callback: () => this.add_hashtags(this.status),
    });

    //reindex vault every 5 hours
    this.registerInterval(
      window.setInterval(() => {
        console.log("Reindexing the vault at:");
        console.log(moment().format("H:mm:ss"));
        this.index_new_and_modified_files();
      }, 1e6 * 2)
    ); // we reindex the new files every 6 hours
    this.addSettingTab(new VCWizardSettingTab(this.app, this));
    this.registerEvent(
      this.app.vault.on("modify", (file) =>
        this.register_file_change(file, FileType.modified)
      )
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) =>
        this.register_file_change(file, FileType.deleted)
      )
    );

    this.status.setText("🧙: Knowledge Wizard ready");
    this.status.setAttr("title", "Wizard is ready");

    //When you start a new vault, all files are considered as "created", we use this delay to avoid this problem and have only new synced files from Readwise labelled as new
    setTimeout(() => {
      this.registerCreatedFile();
    }, 500);
  }

  registerCreatedFile() {
    this.registerEvent(
      this.app.vault.on("create", (file) =>
        this.register_file_change(file, FileType.new)
      )
    );
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(WIZARD_VIEW);
    this.status.setText("🧙: Knowledge Wizard left");
    this.status.setAttr("title", "Wizard says 👋");
  }

  async activateView() {
    this.app.workspace.detachLeavesOfType(WIZARD_VIEW);

    await this.app.workspace.getRightLeaf(false).setViewState({
      type: WIZARD_VIEW,
      active: true,
    });

    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(WIZARD_VIEW)[0]
    );
  }
  async updateView(results: any) {
    const view = this.app.workspace.getLeavesOfType(WIZARD_VIEW)[0]?.view;
    if (view instanceof WizardView) {
      view.update(results);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    scriptPath_AI =
      this.settings.vaultPath + ".obsidian/plugins/knowledge-wizard";
    openaiAPIKey = this.settings.openAIKey;
    pineconeAPIKey = this.settings.pineconeKey;
    pineconeIndexName = this.settings.pineconeIndexName;
    pineconeEnvName = this.settings.pineconeEnv;

    pythonPath = this.settings.pythonPath;
  }

  async saveSettings() {
    await this.saveData(this.settings);
    scriptPath_AI =
      this.settings.vaultPath + ".obsidian/plugins/knowledge-wizard";
    openaiAPIKey = this.settings.openAIKey;
    pineconeEnvName = this.settings.pineconeEnv;
    pineconeAPIKey = this.settings.pineconeKey;
    pineconeIndexName = this.settings.pineconeIndexName;

    pythonPath = this.settings.pythonPath;
  }

  async add_hashtags(status: HTMLElement) {
    const files = this.app.vault.getMarkdownFiles();
    status.setText("🧙: Knowledge Wizard adding Hashtags...");
    status.setAttr("title", "Wizard is adding Hashtags...");
    for (let item of files) {
      let file_content = await this.app.vault.read(item);
      if (file_ready_for_hashtags(file_content)) {
        new Notice(`Adding Hashtags to: ${item.basename}`);
        let scriptName = "hashtag_generator.py";
        let vault_path = this.settings.vaultPath;
        let file_path = item.path;
        let full_path = vault_path + file_path;
        let response: any = await hashtag_generator(full_path, scriptName);
        //console.log(response)
        //this.app.vault.modify(item, response)
      }
    }
    new Notice("Done!");
    status.setText("🧙: Knowledge Wizard ready");
    status.setAttr("title", "Wizard is ready");
  }

  async find_similar_ideas(
    editor: Editor,
    view: MarkdownView | MarkdownFileInfo
  ) {
    const sel = editor.getSelection();
    new Notice("Search in progress...");
    let scriptPath = scriptPath_AI;
    const scriptName = "similar_ideas_pinecone.py"; //'similar_ideas.py'

    var args = [
      sel,
      openaiAPIKey,
      this.settings.vaultPath,
      pineconeAPIKey,
      pineconeIndexName,
      pineconeEnvName,
    ];
    this.status.setText("🧙 🔎: Knowledge Wizard searching...");
    this.status.setAttr("title", "Wizard is searching for similar ideas");

    const similar_ideas = (await launch_python(
      pythonPath,
      scriptPath,
      scriptName,
      args
    )) as any;

    console.log(similar_ideas[0]);
    let dict = JSON.parse(similar_ideas[0]);

    let search_results = await this.extract_title_and_path_json(dict);

    this.updateView(search_results);

    this.status.setText("🧙: Knowledge Wizard ready");
    this.status.setAttr("title", "Wizard is ready");
  }

  async register_file_change(file: TAbstractFile, type: FileType) {
    const plugin_path = scriptPath_AI;
    let base_name = file.name.split(".md")[0];
    let file_path = this.settings.vaultPath + file.path;

    let storage_path = plugin_path + "/modified_paths.json";

    if (type == FileType.modified) {
      let value = { change_type: FileType.modified, full_path: file_path };
      append_to_json(storage_path, base_name, value);
    } else if (type == FileType.deleted) {
      new Notice(`${base_name} has been deleted`);
      let value = { change_type: FileType.deleted, full_path: file_path };
      append_to_json(storage_path, base_name, value);
    }

    //We track a new created file only if is from readwise
    else if (type == FileType.new) {
      console.log(`New File: ${file_path}`);
      if (file_path.contains("Readwise")) {
        new Notice(`${base_name} has been created`);
        let value = { change_type: FileType.new, full_path: file_path };
        append_to_json(storage_path, base_name, value);
      }
    }
  }
  async index_new_and_modified_files() {
    const plugin_path = scriptPath_AI;
    let storage_path = plugin_path + "/modified_paths.json";
    fs.readFile(storage_path, async (err, data: any) => {
      if (err) {
        throw err;
      }

      let files_to_modify;
      new Notice("Reindexing changed files..");
      this.status.setText("🧙: Knowledge Wizard indexing...");
      this.status.setAttr("title", "Wizard is indexing your vault...");
      try {
        files_to_modify = JSON.parse(data);
        console.log(files_to_modify);
      } catch (e) {
        new Notice("No new notes to index");
        this.status.setText("🧙: Knowledge Wizard ready");
        this.status.setAttr("title", "Knowledge Wizard is ready");
        return;
      }
      if (Object.keys(files_to_modify).length < 1) {
        new Notice("No new notes to index");
        this.status.setText("🧙: Knowledge Wizard ready");
        this.status.setAttr("title", "Knowledge Wizard is ready");
        return;
      }

      try {
        await this.index_loop(files_to_modify);
      } catch (e) {
        console.log(e.message);
        new Notice("There was an error while indexing!");
        this.status.setText("🧙: Knowledge Wizard ready");
        this.status.setAttr("title", "Knowledge Wizard is ready");
        return;
      }

      new Notice("Finished indexing!");
      this.status.setText("🧙: Knowledge Wizard ready");
      this.status.setAttr("title", "Knowledge Wizard is ready");
      save_json(storage_path, files_to_modify);
    });
  }

  async index_vault() {
    //Function to index the full vault from scratch

    let files = this.app.vault.getMarkdownFiles();
    let file_paths: any = {};
    let vault_path = this.settings.vaultPath;
    const plugin_path = scriptPath_AI;
    new Notice("Started indexing the full vault!");
    this.status.setText("🧙: Knowledge Wizard indexing...");
    this.status.setAttr("title", "Wizard is indexing your vault...");

    for (let file of files) {
      let lower_case_file_path = file.path.toLowerCase();
      if (
        !(
          lower_case_file_path.includes("projects") ||
          lower_case_file_path.includes("canvas") ||
          lower_case_file_path.includes("resources") ||
          lower_case_file_path.includes("templates") ||
          lower_case_file_path.includes(".jpg")
        )
      ) {
        file_paths[file.basename] = {
          change_type: FileType.new,
          full_path: vault_path + file.path,
        };
      }
    }
    console.log(`Files length: ${file_paths.length}`);
    const json_path = plugin_path + "/" + "file_paths.json";

    save_json(json_path, file_paths);

    await this.index_loop(file_paths);

    new Notice("Finished indexing!");
    this.status.setText("🧙: Knowledge Wizard ready");
    this.status.setAttr("title", "Knowledge Wizard is ready");

    save_json(json_path, file_paths);
  }

  //Indexing to pineconde methods
  async index_file(
    file_path: string,
    modification_type: string,
    file_name: string
  ) {
    let note_text = "";
    try {
      note_text = fs.readFileSync(file_path, "utf8");
    } catch (e) {
      console.log(e.message);
      new Notice(`${file_name} can not be read!`);
      throw Error(`${file_name} can not be read!`);
    }
    const res = await fetch(
      "https://pinecone-indexer-xm5lmdnsxq-ey.a.run.app/index",
      {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file_name,
          note: note_text,
        }),
      }
    );

    const t = await res.text();
    const status = await res.status;

    if (status == 200) {
      new Notice(`Indexed Successfully: ${file_name} !`);
    } else {
      new Notice(`Server error while indexing ${file_name} `);
      throw Error(`Server error while indexing ${file_name}`);
    }
  }

  async index_loop(files_dict: any) {
    let counter = 0;
    let number_of_files = Object.entries(files_dict).length;

    for (let [file_name, file_data] of Object.entries(files_dict) as [
      any,
      any
    ]) {
      new Notice(`${counter}/${number_of_files} has been indexed`);

      try {
        console.log(file_name);
        new Notice(`Indexing: ${file_name}...`);

        await this.index_file(
          file_data["full_path"],
          file_data["change_type"],
          file_name
        );

        counter += 1;
        delete files_dict[file_name];
      } catch (e) {
        console.log(e.message);
        new Notice(e.message);
      }
    }
  }

  async extract_title_and_path_json(results: JSON) {
    let currnet_filename = this.app.workspace.getActiveFile()?.basename;
    let search_results: any = [];
    for (let [note_title, content] of Object.entries(results)) {
      if (note_title.includes("***")) {
        note_title = note_title.split("***")[0];
        //console.log(`note_title: ${note_title}`)
      }
      let source: string = note_title;

      if (source == currnet_filename) {
        //Do not get results from the current file
        continue;
      }
      let source_file = await this.get_path_by_name(source);
      if (source_file != null && source != null) {
        let obsidian_path = "obsidian://advanced-uri?vault="; //open - advanced-uri
        obsidian_path = obsidian_path + this.app.vault.getName() + "&filepath="; //file - filepath
        //let source_path = source_file.path //this.app.vault.getResourcePath(source_file)
        obsidian_path = obsidian_path + source_file.path;
        //console.log(`my source path: ${obsidian_path}`)
        //todo I should not save paths in a dict because I create the overwritting problem again and can not have multiple references to the same article!
        //todo make it an array of dictionaries, that would be the best option!!
        //let result = {source: {"source_path": obsidian_path, "text": content}}

        let result: { [key: string]: any } = {};
        result[source] = { source_path: obsidian_path, text: content };

        console.log(`result: ${result[source]["source_path"]}`);
        search_results.push(result);
        //search_results[source] = {'source_path':obsidian_path, 'text': content}
      }
    }
    return search_results;
  }
  async extract_title_and_path(results: string[]) {
    //todo if we change the source to pinecone, we got longer documents and it is not anymore that the "third line" is the note:title
    //console.log(all_files)
    let counter = 0;
    let search_results: any = {}; //{'sentences': [], 'source_name': [], 'source_path': []}
    let current_filename = this.app.workspace.getActiveFile()?.basename;
    console.log(`current filename: ${current_filename}`);
    for (let result of results) {
      if (counter % 3 == 0 && counter != 0) {
        let sentence = '"' + results.at(counter) + '"';
        let source = results.at(counter + 2);
        source = source?.split(":")[1].trim();

        console.log(`counter: ${counter}, This source: ${source}`);

        if (source == current_filename) {
          //Do not add results from the current file
          counter = counter + 1;
          continue;
        }
        let source_file = await this.get_path_by_name(source);
        console.log(source_file);
        if (source_file != null && source != null) {
          let obsidian_path = "obsidian://advanced-uri?vault="; //open - advanced-uri
          obsidian_path =
            obsidian_path + this.app.vault.getName() + "&filepath="; //file - filepath
          //let source_path = source_file.path //this.app.vault.getResourcePath(source_file)
          obsidian_path = obsidian_path + source_file.path;
          console.log(`my source path: ${obsidian_path}`);
          search_results[source] = {
            source_path: obsidian_path,
            text: sentence,
          };
        }
      }

      counter = counter + 1;
    }
    return search_results;
  }
  async get_path_by_name(source: string | undefined) {
    let all_files = this.app.vault.getMarkdownFiles();
    for (let file of all_files) {
      let filename = file.basename;
      if (filename == source) {
        return file;
      }
    }
    return null;
  }
}

class VCWizardSettingTab extends PluginSettingTab {
  plugin: VCWizardPlugin;
  constructor(app: App, plugin: VCWizardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for your Knowledge Wizard" });

    new Setting(containerEl)
      .setName("Obsidian Vault Path")
      .setDesc("The path to the vault where you wish to use the plugin")
      .addText((text) =>
        text
          .setPlaceholder("Enter path")
          .setValue(this.plugin.settings.vaultPath)
          .onChange(async (value) => {
            console.log("path: " + value);
            this.plugin.settings.vaultPath = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("Your OpenAI API Key")
      .addText((text) =>
        text
          .setPlaceholder("Enter key")
          .setValue(this.plugin.settings.openAIKey)
          .onChange(async (value) => {
            console.log("Open AI key: " + value);
            this.plugin.settings.openAIKey = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Python Virtual Environment Path")
      .setDesc("The path to python virtual environment")
      .addText((text) =>
        text
          .setPlaceholder("Enter path")
          .setValue(this.plugin.settings.pythonPath)
          .onChange(async (value) => {
            console.log("PythonPath: " + value);
            this.plugin.settings.pythonPath = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Pinecone API Key")
      .setDesc("Your Pinecone API Key")
      .addText((text) =>
        text
          .setPlaceholder("Enter key")
          .setValue(this.plugin.settings.pineconeKey)
          .onChange(async (value) => {
            console.log("Pinecone key: " + value);
            this.plugin.settings.pineconeKey = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Pinecone Index Name")
      .setDesc("Your Pinecone Index Name")
      .addText((text) =>
        text
          .setPlaceholder("Enter name")
          .setValue(this.plugin.settings.pineconeIndexName)
          .onChange(async (value) => {
            console.log("Pinecone Index Name: " + value);
            this.plugin.settings.pineconeIndexName = value;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("Pinecone Envrionment Name")
      .setDesc("e.g: us-east1-gcp")
      .addText((text) =>
        text
          .setPlaceholder("Enter environment")
          .setValue(this.plugin.settings.pineconeEnv)
          .onChange(async (value) => {
            console.log("Pinecone Envrionment Name: " + value);
            this.plugin.settings.pineconeEnv = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Number of sub-links to read for URL Research")
      .setDesc("default is 6")
      .addText((text) =>
        text
          .setPlaceholder("6")
          .setValue(this.plugin.settings.links_num)
          .onChange(async (value) => {
            this.plugin.settings.links_num = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

interface ButlerSettings {
  vaultPath: string;
  openAIKey: string;
  pineconeKey: string;
  pineconeIndexName: string;
  pineconeEnv: string;
  pythonPath: string;
  links_num: string;
}

const DEFAULT_SETTINGS: ButlerSettings = {
  vaultPath: "default",
  openAIKey: "default",
  pineconeKey: "default",
  pineconeIndexName: "default",
  pineconeEnv: "us-east1-gcp",
  pythonPath: "<path-to-virtual-env>",
  links_num: "6",
};
