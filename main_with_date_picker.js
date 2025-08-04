// main.js
const { Plugin, Notice, Setting, PluginSettingTab, TFile, normalizePath, Modal, TextComponent } = require('obsidian');

// Date picker modal
class DatePickerModal extends Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
    this.selectedDate = new Date();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Select Date for Daily Note" });

    // Date input
    new Setting(contentEl)
      .setName("Date")
      .setDesc("Select the date for the daily note")
      .addText(text => {
        // Format today's date as YYYY-MM-DD for the input default
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        text
          .setValue(dateStr)
          .onChange(value => {
            // Parse the date string
            const parts = value.split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
              const day = parseInt(parts[2]);
              this.selectedDate = new Date(year, month, day);
            }
          });
        
        // Store the input element for focus
        this.dateInput = text.inputEl;
        this.dateInput.type = "date"; // Use HTML5 date picker
      });

    // Quick date buttons
    new Setting(contentEl)
      .setName("Quick select")
      .setDesc("Choose a common date")
      .addButton(button => button
        .setButtonText("Today")
        .onClick(() => {
          this.selectedDate = new Date();
          this.updateDateInput();
        }))
      .addButton(button => button
        .setButtonText("Yesterday")
        .onClick(() => {
          const date = new Date();
          date.setDate(date.getDate() - 1);
          this.selectedDate = date;
          this.updateDateInput();
        }))
      .addButton(button => button
        .setButtonText("Tomorrow")
        .onClick(() => {
          const date = new Date();
          date.setDate(date.getDate() + 1);
          this.selectedDate = date;
          this.updateDateInput();
        }));

    // Submit and Cancel buttons
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText("Create")
        .setCta()
        .onClick(() => {
          this.close();
          this.onSubmit(this.selectedDate);
        }))
      .addButton(button => button
        .setButtonText("Cancel")
        .onClick(() => {
          this.close();
        }));
  }

  updateDateInput() {
    const dateStr = `${this.selectedDate.getFullYear()}-${String(this.selectedDate.getMonth() + 1).padStart(2, '0')}-${String(this.selectedDate.getDate()).padStart(2, '0')}`;
    this.dateInput.value = dateStr;
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

// --- Renamed Setting Tab ---
class CustomCommandsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    // Add button to create new command
    new Setting(containerEl)
      .setName('Add new command')
      .setDesc('Create a new custom command') // Updated description
      .addButton(button => button
        .setButtonText('Add command')
        .setCta()
        .onClick(async () => {
            // Create a new command with a default ID based on the name
            const newCommand = {
            id: "new-command", // Will be normalized on name change
            type: 'open', // Default to 'open' type
            name: 'New command',
            path: '', // For 'open' and 'create'
            templatePath: '', // For 'create'
            snippet: '', // For 'insert'
            commandIds: '' // For 'sequence'
            };
            
            // Generate ID from name (lowercase with spaces replaced by hyphens)
            newCommand.id = newCommand.name.toLowerCase().replace(/\s+/g, '-');
            
            this.plugin.settings.commands.push(newCommand);
          await this.plugin.saveSettings();
          this.display(); // Refresh the settings panel
        }));

    // Display existing commands
    this.plugin.settings.commands.forEach((command, index) => {
      const commandSetting = new Setting(containerEl)
      .setClass('command-setting'); // Main setting row for the command

      // --- Command Type Dropdown ---
      commandSetting.addDropdown(dropdown => dropdown
      .addOption('open', 'Open')
      .addOption('create', 'Create')
      .addOption('create-with-date', 'Create with Date')
      .addOption('insert', 'Insert')
      .addOption('sequence', 'Sequence')
      .setValue(command.type || 'open') // Default to 'open' if type is missing
      .onChange(async (value) => {
        this.plugin.settings.commands[index].type = value;
        // Clear out fields not relevant to the new type
        if (value !== 'open' && value !== 'create' && value !== 'create-with-date') this.plugin.settings.commands[index].path = '';
        if (value !== 'create' && value !== 'create-with-date') this.plugin.settings.commands[index].templatePath = '';
        if (value !== 'insert') this.plugin.settings.commands[index].snippet = '';
        if (value !== 'sequence') this.plugin.settings.commands[index].commandIds = '';
        await this.plugin.saveSettings();
        this.plugin.registerCommands(); // Re-register needed if type changes behavior
        this.display(); // Refresh UI to show relevant fields
      }));

      // Command name input
      commandSetting.addText(text => text
      .setPlaceholder('Command name')
      .setValue(command.name)
      .onChange(async (value) => {
        this.plugin.settings.commands[index].name = value;
        await this.plugin.saveSettings();
        // No need to re-register just for name change if ID remains stable
        // However, Obsidian hotkeys link to the command *name* shown in settings,
        // so re-registering ensures the hotkey list updates if the name changes.
        this.plugin.registerCommands();
      }));

      // --- Conditional Inputs that fill remaining space ---
      switch (command.type) {
      case 'open':
        commandSetting.addText(text => text
        .setPlaceholder('Path: daily/{{date}}.md)')
        .setValue(command.path || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].path = normalizePath(value);
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        break;
      case 'create':
        commandSetting.addText(text => text
        .setPlaceholder('New path: notes/{{date}}.md')
        .setValue(command.path || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].path = normalizePath(value);
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        
        // Template path on new line for 'create' (inline with CSS)
        const createTemplateSetting = new Setting(containerEl)
          .setClass('command-template-setting')
          .addText(text => text
            .setPlaceholder('Template path (optional): templates/daily.md')
            .setValue(command.templatePath || '')
            .onChange(async (value) => {
              this.plugin.settings.commands[index].templatePath = normalizePath(value);
              await this.plugin.saveSettings();
            })
            .inputEl.addClass('custom-command-input-full-width'));
        break;
      case 'create-with-date':
        commandSetting.addText(text => text
        .setPlaceholder('New path: notes/{{date}}.md')
        .setValue(command.path || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].path = normalizePath(value);
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        
        // Template path on new line for 'create-with-date' (inline with CSS)
        const createWithDateTemplateSetting = new Setting(containerEl)
          .setClass('command-template-setting')
          .addText(text => text
            .setPlaceholder('Template path (optional): templates/daily.md')
            .setValue(command.templatePath || '')
            .onChange(async (value) => {
              this.plugin.settings.commands[index].templatePath = normalizePath(value);
              await this.plugin.saveSettings();
            })
            .inputEl.addClass('custom-command-input-full-width'));
        break;
      case 'insert':
        commandSetting.addTextArea(text => text
        .setPlaceholder('Snippet text...')
        .setValue(command.snippet || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].snippet = value;
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        break;
      case 'sequence':
        commandSetting.addText(text => text
        .setPlaceholder('Command names (comma-separated)...')
        .setValue(command.commandIds || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].commandIds = value;
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        break;
      }

      // Remove button
      commandSetting.addButton(button => button
      .setButtonText('Remove')
      .setWarning()
      .onClick(async () => {
        this.plugin.settings.commands.splice(index, 1);
        await this.plugin.saveSettings();
        this.plugin.registerCommands(); // Re-register when a command is removed
        this.display(); // Refresh the settings panel
      }));
    });
    
    // --- New Setting for Leaf Behavior ---
    new Setting(containerEl)
        .setName('Open in new tab')
        .setDesc('If enabled, notes will open in a new tab. Otherwise, they open in the current tab.')
        .addToggle(toggle => toggle
        .setValue(this.plugin.settings.leaf)
        .onChange(async (value) => {
            this.plugin.settings.leaf = value;
            await this.plugin.saveSettings();
        }));
  }
}

// --- Default Settings ---
const DEFAULT_SETTINGS = {
  commands: [
      {
        "id": "open-home",
        "name": "Open home",
        "path": normalizePath("Home"),
        "type": "open",
        "templatePath": "",
        "snippet": "",
        "commandIds": ""
      },
      {
        "id": "create-today",
        "name": "Create today",
        "path": normalizePath("Daily/{{date}}-{{weekday}}"),
        "type": "create",
        "templatePath": "",
        "snippet": "",
        "commandIds": ""
      },
      {
        "id": "start-day",
        "type": "insert",
        "name": "Start day",
        "path": "",
        "templatePath": "",
        "snippet": "Hello! It's {{date}} at {{time}}. Have a lovely day!",
        "commandIds": ""
      },
      {
        "id": "sequence-today",
        "type": "sequence",
        "name": "Sequence today",
        "path": "",
        "templatePath": "",
        "snippet": "",
        "commandIds": "Create today, Start day"
      }
  ],// Structure: { id: string, type: 'open'|'create'|'insert'|'sequence', name: string, path?: string, templatePath?: string, snippet?: string, commandIds?: string }
    leaf: false // Default to opening in current tab
};

// --- Renamed Plugin Class ---
module.exports = class CustomCommandsPlugin extends Plugin {
  async onload() {
    // console.log('Loading Custom Commands Plugin'); // Renamed

    // Load settings
    await this.loadSettings();

    // Register all custom commands from settings
    this.registerCommands();

    // Add settings tab
    this.addSettingTab(new CustomCommandsSettingTab(this.app, this)); // Use renamed tab
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Ensure default type for older commands if necessary
    this.settings.commands.forEach(cmd => {
        if (!cmd.type) cmd.type = 'open';
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Register or re-register all commands from settings
  registerCommands() {
    // First, unregister any previously registered commands
    if (this.registeredCommandIds) {
      this.registeredCommandIds.forEach(cmdId => {
        if (this.app.commands.removeCommand) {
          // Use the proper command removal API
          this.app.commands.removeCommand(cmdId);
        }
      });
    }

    // Initialize tracking set if it doesn't exist yet
    if (!this.registeredCommandIds) {
      this.registeredCommandIds = new Set();
    } else {
      this.registeredCommandIds.clear();
    }

    // Register each custom command
    this.settings.commands.forEach(command => {
      // Keep the command ID format consistent with what worked before
      const commandId = `custom-cmd-${command.id}`;
      const fullCommandId = `${this.manifest.id}:${commandId}`;
      
      try {
        this.addCommand({
          id: commandId,
          name: command.name,
          callback: () => {
            // Add proper error handling in callback
            try {
              switch (command.type) {
                case 'open':
                  const resolvedOpenPath = this.resolveDatePlaceholders(command.path);
                  this.openNote(resolvedOpenPath);
                  break;
                case 'create':
                  const resolvedCreatePath = this.resolveDatePlaceholders(command.path);
                  const resolvedTemplatePath = this.resolveDatePlaceholders(command.templatePath);
                  this.createNote(resolvedCreatePath, resolvedTemplatePath);
                  break;
                case 'create-with-date':
                  // Show date picker modal
                  new DatePickerModal(this.app, (selectedDate) => {
                    const resolvedCreatePath = this.resolveDatePlaceholders(command.path, selectedDate);
                    const resolvedTemplatePath = this.resolveDatePlaceholders(command.templatePath, selectedDate);
                    this.createNote(resolvedCreatePath, resolvedTemplatePath);
                  }).open();
                  break;
                case 'insert':
                  const resolvedSnippet = this.resolveDatePlaceholders(command.snippet);
                  this.insertSnippet(resolvedSnippet);
                  break;
                case 'sequence':
                  this.runCommandSequence(command.commandIds);
                  break;
                default:
                  console.warn(`Unknown command type: ${command.type}`);
                  new Notice(`Unknown command type: ${command.type}`);
              }
            } catch (error) {
              console.error(`Error executing command ${command.name}:`, error);
              new Notice(`Error executing command ${command.name}: ${error.message}`);
            }
          }
        });
        
        // Track this command ID for future cleanup
        this.registeredCommandIds.add(fullCommandId);
        
        // Debug logging - remove in production version
        // console.log(`Registered command: ${command.name} (ID: ${commandId})`);
      } catch (error) {
        console.error(`Failed to register command ${command.name}:`, error);
      }
    });
  }

  // Add a cleanup in onunload:
  onunload() {
    if (this.registeredCommandIds && this.app.commands.removeCommand) {
      this.registeredCommandIds.forEach(cmdId =>
        this.app.commands.removeCommand(cmdId));
    }
  }

  // --- New Command Implementation Methods ---

  async createNote(notePath, templatePath = '') {
    try {
        if (!notePath) {
            new Notice('No note path specified for creation.');
            return;
        }

        // Ensure .md extension
        if (!notePath.endsWith('.md')) {
            notePath += '.md';
        }

        // Check if file already exists
        const existingFile = this.app.vault.getAbstractFileByPath(notePath);
        if (existingFile instanceof TFile) {
            new Notice(`Note "${notePath}" already exists. Opening it.`);
            await this.app.workspace.getLeaf(this.settings.leaf).openFile(existingFile);
            return;
        }

        // Ensure parent directory exists
        const parentDir = notePath.substring(0, notePath.lastIndexOf('/'));
        if (parentDir && !this.app.vault.getAbstractFileByPath(parentDir)) {
            await this.app.vault.createFolder(parentDir);
            //console.log(`Created folder: ${parentDir}`);
        }


        // Get template content if specified
        let content = '';
        if (templatePath) {
            const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
            if (templateFile instanceof TFile) {
                content = await this.app.vault.read(templateFile);
                // Resolve template placeholders if needed (basic date ones for now)
                content = this.resolveDatePlaceholders(content);
            } else {
                new Notice(`Template file "${templatePath}" not found.`);
                // Continue with empty content
            }
        }

        // Create and open the new note
        const newFile = await this.app.vault.create(notePath, content);
        new Notice(`Created note: "${notePath}"`);
        await this.app.workspace.getLeaf(this.settings.leaf).openFile(newFile); // Open in new leaf

    } catch (error) {
        console.error('Error creating note:', error);
        new Notice(`Error creating note: ${error.message}`);
    }
  }


  insertSnippet(snippet) {
    const editor = this.app.workspace.activeEditor?.editor;
    if (editor) {
      editor.replaceSelection(snippet || '');
    } else {
      new Notice('No active editor found to insert snippet.');
    }
  }

  async runCommandSequence(commandNamesString) {
    if (!commandNamesString) {
      new Notice('No command names provided for sequence.');
      return;
    }

    // Split by comma and trim whitespace
    const commandNames = commandNamesString.split(',').map(name => name.trim()).filter(name => name);

    if (commandNames.length === 0) {
      new Notice('No valid command names found in sequence.');
      return;
    }

    // console.log(`Running command sequence by name: ${commandNames.join(', ')}`);

    // Get all available commands (core, plugins, custom)
    const allCommands = this.app.commands.commands;
    
    let notFound = [];
    
    // // Log all available commands for debugging
    // Object.keys(allCommands).forEach(id => {
    //   console.log(`Command ID: ${id}, Name: ${allCommands[id].name}, Type: ${allCommands[id].type}, Command: ${allCommands[id].command}, Description: ${allCommands[id].description}, Category: ${allCommands[id].category}`,
    //     allCommands[id].name === 'custom-cmd' ? ' (Custom Command)' : ''); // Custom command check
    // });

    for (const name of commandNames) {
      
      // Find the command ID by its name (case-insensitive search is safer)
      // Find the command ID by its name, ignoring plugin prefixes
      const commandId = Object.keys(allCommands).find(id => {
        const commandName = allCommands[id].name;
        // Convert to lowercase for case-insensitive matching
        const lowerCommandName = commandName.toLowerCase();
        const lowerSearchName = name.toLowerCase();
        
        // Direct match check
        if (lowerCommandName === lowerSearchName) {
          return true;
        }
        
        // Check for "Plugin: Command Name" format
        const colonIndex = lowerCommandName.indexOf(': ');
        if (colonIndex !== -1) {
          // Extract the part after ": "
          const strippedName = lowerCommandName.substring(colonIndex + 2);
          return strippedName === lowerSearchName;
        }
        
        return false;
      });

      if (commandId) {
        //console.log(`Executing command: ${name} (ID: ${commandId})`);
        try {
          // Execute the command by its found ID
          await this.app.commands.executeCommandById(commandId);
          // Optional: Add a small delay if commands need time to complete UI updates
          await sleep(50);
        } catch (error) {
          new Notice(`Error executing command "${name}": ${error.message}`);
          console.error(`Error executing command "${name}" (ID: ${commandId}):`, error);
          // Decide if you want to stop the sequence on error or continue
          // break; // Uncomment to stop sequence on first error
        }
      } else {
        console.warn(`Command name not found: "${name}"`);
        notFound.push(name);
      }
    }

    if (notFound.length > 0) {
      new Notice(`Sequence finished. Could not find commands: ${notFound.join(', ')}`);
    } else {
      //new Notice('Command sequence finished successfully.');
    }
  }


  // --- Modified resolveDatePlaceholders to accept custom date ---
  // Resolve date placeholders in the path
  resolveDatePlaceholders(path, customDate = null) {
    if (!path) return path;

    // Use custom date if provided, otherwise use current date
    const baseDate = customDate || new Date();

    // Replace date placeholders
    // Format: {{date}} or {{date:FORMAT}} or {{date+N}} or {{date-N}}
    let resolvedPath = path.replace(/\{\{date(\+|-)?(\d+)?(:([^}]+))?\}\}/g, (match, op, offsetStr, _, format) => {
      // Calculate date with offset if provided
      let date = new Date(baseDate);
      if (op && offsetStr) {
        const offset = parseInt(offsetStr);
        const days = op === '+' ? offset : -offset;
        date.setDate(date.getDate() + days);
      }

      // Apply format if provided, otherwise use YYYY-MM-DD
      if (format) {
        return this.formatDate(date, format);
      } else {
        return this.formatDate(date, "YYYY-MM-DD");
      }
    });

    // Replace other placeholders using the base date
    resolvedPath = resolvedPath
        .replace(/\{\{year\}\}/g, baseDate.getFullYear().toString())
        .replace(/\{\{month\}\}/g, String(baseDate.getMonth() + 1).padStart(2, '0'))
        .replace(/\{\{day\}\}/g, String(baseDate.getDate()).padStart(2, '0'))
        .replace(/\{\{weekday\}\}/g, this.getWeekdayName(baseDate.getDay()))
        .replace(/\{\{monthName\}\}/g, this.getMonthName(baseDate.getMonth()));

    // --- Add Time Placeholders (use current time even if custom date) ---
    const now = new Date(); // For time, we still use current time
    resolvedPath = resolvedPath
        .replace(/\{\{time\}\}/g, this.formatTime(now, "HH:mm")) // Default time format
        .replace(/\{\{time:([^}]+)\}\}/g, (match, format) => this.formatTime(now, format)); // Custom time format

    return resolvedPath;
  }

  // Format date according to format string
  formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekday = this.getWeekdayName(date.getDay());
    const monthName = this.getMonthName(date.getMonth());

    return format
      .replace(/YYYY/g, year.toString())
      .replace(/MM/g, month)
      .replace(/DD/g, day)
      .replace(/dddd/g, weekday) // Full weekday name
      .replace(/ddd/g, weekday.substring(0, 3)) // Short weekday name
      .replace(/mmmm/g, monthName) // Full month name
      .replace(/mmm/g, monthName.substring(0, 3)); // Short month name
  }

  // --- Add Time Formatting ---
  formatTime(date, format) {
      const hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const hours12 = String(hours % 12 || 12).padStart(2, '0'); // 12-hour format
      const ampm = hours >= 12 ? 'PM' : 'AM';

      return format
          .replace(/HH/g, String(hours).padStart(2, '0')) // 24-hour
          .replace(/hh/g, hours12) // 12-hour
          .replace(/mm/g, minutes)
          .replace(/ss/g, seconds)
          .replace(/A/g, ampm); // AM/PM
  }


  // Get weekday name from day number (0-6)
  getWeekdayName(dayNum) {
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return weekdays[dayNum];
  }

  getMonthName(monthNum) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNum];
  }

  // Open a specific note by path
  async openNote(notePath) {
    try {
      if (!notePath) {
        new Notice('No note path specified');
        return;
      }

      // Ensure .md extension
      if (!notePath.endsWith('.md')) {
        notePath = notePath + '.md';
      }

      // Use getFirstLinkpathDest to resolve the path to a file
      let file = this.app.metadataCache.getFirstLinkpathDest(notePath, '');

      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(this.settings.leaf).openFile(file);
      } else {
        new Notice(`Note "${notePath}" not found.`);
      }
    } catch (error) {
      console.error('Error opening note:', error);
      new Notice(`Error opening note: ${error.message}`);
    }
  }

  onunload() {
    // console.log('Unloading Custom Commands Plugin'); // Renamed
    // Consider cleanup if commands were registered in a way that needs explicit removal
  }
}

// Helper function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}