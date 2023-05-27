import { ItemView, WorkspaceLeaf } from "obsidian";

export const WIZARD_VIEW = "wizard-view";

export class WizardView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.icon = 'sun'
  }

  getViewType() {
    return WIZARD_VIEW;
  }

  getDisplayText() {
    return "Related Ideas";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl("h4", {text: "Related Ideas", cls: "heading"});
  }

  async update(search_results: [{[key: string]: any}] ){ //
    const container = this.containerEl.children[1];
    //container.createEl("div", {text: "Hello World"})
    container.empty()
    const outerDiv = container.createEl("h4", {text: "Related Ideas\n", cls: "heading"});
    //console.log("Lets updateee")
    for (let dict of search_results){
      //console.log(`HELLO DICT: ${dict}`)
      let source_name = Object.keys(dict)[0]
      //console.log(`HELLO SOURCE NAME: ${source_name}`)
      //let source_name = key
      // @ts-ignore
      let info = dict[source_name]
      let source_path = info['source_path']
      let text = info['text']
      const quote = container.createEl("blockquote", {text: text, cls: "quote"})
      const link = quote.createEl("a", { href: source_path, attr: { "data-path": source_path } });
      link.createEl("span", {   
                  text: '\n--' + source_name 
          }
      );



    }

    //container.createEl("div", {text: results.at(0)})
    //outerDiv.createEl("div", { text: "" });
    //outerDiv.createEl("div", { cls: "outgoing-link-header", text: "⛰" });
    

  }

  async onClose() {
    // Nothing to clean up.
  }
}