// A small window that asks a yes or no question before an action that would lose work.
import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";

export class ConfirmModal extends Modal {
  private readonly title: string;
  private readonly message: string;
  private readonly confirmLabel: string;
  private readonly onConfirm: () => void;
  private readonly onCancel: () => void;
  private answered = false;

  // Creates the window with its texts and the two functions to call.
  constructor(app: App, title: string, message: string, confirmLabel: string, onConfirm: () => void, onCancel: () => void) {
    super(app);
    this.title = title;
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  // Draws the question and its two buttons.
  onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.createEl(`p`, { text: this.message });
    new Setting(this.contentEl)
      .addButton((b) => b.setButtonText(t(`Annuler`)).onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText(this.confirmLabel)
          .setWarning()
          .onClick(() => {
            this.answered = true;
            this.close();
            this.onConfirm();
          }),
      );
  }

  // Calls the cancel function when the window closes without a confirmation.
  onClose(): void {
    this.contentEl.empty();
    if (!this.answered) this.onCancel();
  }
}
