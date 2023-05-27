import { App, Modal, Setting} from 'obsidian';

export class TextInputModal extends Modal {
    input: string;
    onsubmit: (input: string) => void;
    type: string;
  
    constructor(app: App, type:string,  onsubmit: (input: string) => void) {
      super(app);
      this.onsubmit = onsubmit;
      this.type = type;
    }

  
    onOpen() {
      const { contentEl } = this;
      let title = ''
      if (this.type == 'market-research'){title = 'What industry do you want to research?'}
      if (this.type == 'defensibility'){title = 'Describe the startup whose defensibility is to be evaluated'}
      contentEl.createEl('h2', { text: title });
  
      new Setting(contentEl).setName("Input")
      const inputEl = contentEl.createEl('input', { type: 'text' });
      inputEl.addEventListener('input', (event) => {
        event.stopPropagation();
      });
  
      const submitButton = contentEl.createEl('button', { text: 'Submit' });
      submitButton.addEventListener('click', () => {
        this.onsubmit(inputEl.value);
        this.close();
      });
    }
    onClose() {
        let { contentEl } = this;
        contentEl.empty();
      }
  }

