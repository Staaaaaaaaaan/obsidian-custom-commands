// main.js
const { Plugin, Notice, Setting, PluginSettingTab, TFile, normalizePath} = require('obsidian');

// --- Renamed Setting Tab ---
class CustomCommandsSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty(); // Clear previous settings to avoid duplication

    // Add button to create new command
    new Setting(containerEl)
      .setName('Add new command')
      .setDesc('Create a new custom command')
      .addButton(button => button
        .setButtonText('Add command')
        .setCta()
        .onClick(async () => {
            // Create a new command with a default ID based on the name
            const newCommand = {
            id: "new-command", // Will be normalized on name change
            type: 'open', // Default to 'open' type
            name: 'New command', // Sentence case
            path: '', // For 'open' and 'create'
            templatePath: '', // For 'create'
            snippet: '', // For 'insert'
            commandIds: '' // For 'sequence'
            };

            // Generate ID from name (lowercase with spaces replaced by hyphens)
            // Ensure uniqueness or handle collisions if necessary
            newCommand.id = newCommand.name.toLowerCase().replace(/\s+/g, '-');
            // Basic collision handling (append timestamp if ID exists)
            if (this.plugin.settings.commands.some(cmd => cmd.id === newCommand.id)) {
                newCommand.id = `${newCommand.id}-${Date.now()}`;
            }

            this.plugin.settings.commands.push(newCommand);
          await this.plugin.saveSettings();
          this.display(); // Refresh the settings panel
        }));

    // Display existing commands
    this.plugin.settings.commands.forEach((command, index) => {
      const commandSetting = new Setting(containerEl)
      .setClass('command-setting') // Main setting row for the command
      .addClass('custom-commands-setting-item'); // Add specific class for CSS targeting

      // --- Command Type Dropdown ---
      commandSetting.addDropdown(dropdown => dropdown
      .addOption('open', 'Open')
      .addOption('create', 'Create')
      .addOption('insert', 'Insert')
      .addOption('sequence', 'Sequence')
      .setValue(command.type || 'open') // Default to 'open' if type is missing
      .onChange(async (value) => {
        this.plugin.settings.commands[index].type = value;
        // Clear out fields not relevant to the new type
        if (value !== 'open' && value !== 'create') this.plugin.settings.commands[index].path = '';
        if (value !== 'create') this.plugin.settings.commands[index].templatePath = '';
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
        const oldId = this.plugin.settings.commands[index].id;
        const newId = value.toLowerCase().replace(/\s+/g, '-');
        this.plugin.settings.commands[index].name = value;
        // Update ID based on name, ensuring uniqueness
        if (oldId !== newId) {
            let finalId = newId;
            let counter = 1;
            // Check if the new ID already exists (excluding the current command being renamed)
            while (this.plugin.settings.commands.some((cmd, i) => i !== index && cmd.id === finalId)) {
                finalId = `${newId}-${counter++}`;
            }
            this.plugin.settings.commands[index].id = finalId;
        }
        await this.plugin.saveSettings();
        // Re-register commands after name/ID change
        this.plugin.registerCommands();
      }));

      // --- Conditional Inputs that fill remaining space ---
      switch (command.type) {
      case 'open':
        commandSetting.addText(text => text
        .setPlaceholder('Path: daily/{{date}}.md') // Sentence case
        .setValue(command.path || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].path = normalizePath(value);
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        break;
      case 'create':
        commandSetting.addText(text => text
        .setPlaceholder('New path: notes/{{date}}.md') // Sentence case
        .setValue(command.path || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].path = normalizePath(value);
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));

        commandSetting.addText(text => text
        .setPlaceholder('Template path (optional)') // Sentence case
        .setValue(command.templatePath || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].templatePath = normalizePath(value);
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        break;
      case 'insert':
        commandSetting.addTextArea(text => text
        .setPlaceholder('Snippet to insert...')
        .setValue(command.snippet || '')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].snippet = value;
          await this.plugin.saveSettings();
        })
        .inputEl.addClass('custom-command-input-full-width'));
        break;
      case 'sequence':
        commandSetting.addText(text => text
          .setPlaceholder('Command names (comma-separated)') // Sentence case
          .setValue(command.commandIds || '') // Keep using commandIds field internally
          .onChange(async (value) => {
            this.plugin.settings.commands[index].commandIds = value; // Store the names string
            await this.plugin.saveSettings();
          })
          .inputEl.addClass('custom-command-input-full-width'));
          break;
      }

      // Delete button
      commandSetting.addButton(button => button
      .setIcon('trash')
      .setTooltip('Delete command')
      .onClick(async () => {
        this.plugin.settings.commands.splice(index, 1);
        await this.plugin.saveSettings();
        this.plugin.registerCommands(); // Re-register after deletion
        this.display(); // Refresh the settings panel
      }));
    });

    // Information about custom commands
    const commandInfo = containerEl.createEl('p');
    commandInfo.innerHTML = 'Create custom commands to <strong>open</strong> notes, <strong>create</strong> new notes at a specified path, <strong>insert</strong> text or code snippets, or run a combination <strong>sequence</strong> of other commands. To set hotkeys for these commands, go to <strong>Settings → Hotkeys</strong> and search for the command name.';
    commandInfo.style.marginBottom = '0.5em'; // Reduce space after header

    new Setting(containerEl)
      .setName('New note option') // Sentence case
      .setDesc('Open notes in new tab (leaf), window, or current tab?')
      .addDropdown(dropdown => dropdown
        .addOption('true', 'New')
        .addOption('false', 'Current')
        .addOption('window', 'Window')
        .setValue(String(this.plugin.settings.leaf)) // Read the actual setting
        .onChange(async (value) => {
          // Parse the value back to the correct type before saving
          let actualValue;
          if (value === 'true') actualValue = true;
          else if (value === 'false') actualValue = false;
          else actualValue = value; // Should be 'window'

          this.plugin.settings.leaf = actualValue;
          await this.plugin.saveSettings();
        }));

    // Add horizontal separator
    const separator = containerEl.createEl('hr');
    separator.style.marginTop = '0.5em';
    separator.style.marginBottom = '1.5em';
    separator.style.opacity = '0.35'; // Make it slightly more visible
    separator.style.width = '100%';  // Ensure full width

    // Add test button for format preview
    const testHeader = containerEl.createEl('h3', { text: 'Test date format' });
    testHeader.style.marginBottom = '0.5em'; // Reduce space after header
    testHeader.style.marginTop = '0em'; // Reduce space after header
    const testContainer = containerEl.createEl('div');
    testContainer.addClass('test-format-container');

    const testInput = testContainer.createEl('input');
    testInput.type = 'text';
    testInput.placeholder = 'Enter format (e.g., daily/{{date:YYYY-MM-DD-dddd}}.md)';
    testInput.value = 'Daily/{{year}}/{{date:MM-mmmm}}/{{date}}-{{weekday}}-{{time}}.md';

    const testButton = testContainer.createEl('button');
    testButton.setText('Test format');
    testButton.addClass('mod-cta');
    testButton.style.marginBottom = '0em'; // Reduce space after button

    const testResult = testContainer.createEl('div');
    testResult.addClass('test-result');
    testResult.style.marginTop = '0em'; // Reduce space after paragraph

    testButton.addEventListener('click', () => {
      const format = testInput.value;
      // Ensure resolveDatePlaceholders exists on the plugin instance
      if (this.plugin.resolveDatePlaceholders) {
          const result = this.plugin.resolveDatePlaceholders(format);
          testResult.setText(`Result: ${result}`);
      } else {
          testResult.setText('Error: resolveDatePlaceholders function not found.');
          console.error("resolveDatePlaceholders function missing on plugin instance.");
      }
    });

    // Add section for date format templates

    const formatIntro = containerEl.createEl('p', { text: 'Date placeholders:' });
    formatIntro.style.marginTop = '0em'; // Reduce space after paragraph
    formatIntro.style.marginBottom = '0em'; // Reduce space after paragraph

    const formatList = containerEl.createEl('p');
    formatList.style.marginTop = '0em'; // Reduce space before list
    ['{{date}} - Current date (YYYY-MM-DD)',
      '{{date:YYYY-MM-DD}} - Custom date format',
      '{{date-1}} - Yesterday\'s date',
      '{{year}}, {{month}}, {{day}} - Current year (YYYY), month (MM), day (DD)',
      '{{dddd}}/{{weekday}} - Day of week name (Monday)',
      '{{mmmm}}/{{monthName}} - Name of month (January)',
      '{{time}} - Current time (HH:mm)',
    ].forEach(item => {
      formatList.createEl('li', { text: item });
    });
  }
}

const DEFAULT_SETTINGS = {
  commands: [
      {
        "id": "open-home",
        "name": "Open home", // Sentence case
        "path": normalizePath("00/Home.md"),
        "type": "open"
      },
      {
        "id": "create-today",
        "name": "Create today", // Sentence case
        "path": normalizePath("Daily/{{date}}-{{weekday}}"),
        "type": "create",
        "templatePath": "",
        "snippet": "",
        "commandIds": ""
      },
      {
        "id": "start-day",
        "type": "insert",
        "name": "Start day", // Sentence case
        "path": "",
        "templatePath": "",
        "snippet": "Hello! It's {{date}} at {{time}}. Have a lovely day!",
        "commandIds": ""
      },
      {
        "id": "sequence-today",
        "type": "sequence",
        "name": "Sequence today", // Sentence case
        "path": "",
        "templatePath": "",
        "snippet": "",
        "commandIds": "Create Today, Start Day" // Keep names as user enters them
      }
  ],
    leaf: false // Default to opening in current tab
};

// --- Renamed Plugin Class ---
module.exports = class CustomCommandsPlugin extends Plugin {
  // Keep track of registered command IDs to manage removal
  registeredCommandIds = new Set();

  async onload() {
    // console.log('Loading Custom Commands Plugin');

    // Load settings
    await this.loadSettings();

    // Register all custom commands from settings
    this.registerCommands();

    // Add settings tab
    this.addSettingTab(new CustomCommandsSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // Ensure default type for older commands if necessary
    this.settings.commands.forEach(cmd => {
        if (!cmd.type) cmd.type = 'open';
        // Ensure all commands have an ID (for older versions)
        if (!cmd.id) {
            cmd.id = cmd.name.toLowerCase().replace(/\s+/g, '-');
            // Handle potential collisions during migration if needed
        }
    });
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Register or re-register all commands from settings
  registerCommands() {
    const newRegisteredIds = new Set();

    // Unregister commands that are no longer in settings or have changed ID
    this.registeredCommandIds.forEach(fullCommandId => {
      const commandIdWithoutPrefix = fullCommandId.split(':')[1];
      // Check if the command ID (without prefix) still exists in the current settings
      if (!this.settings.commands.some(cmd => `custom-cmd-${cmd.id}` === commandIdWithoutPrefix)) {
        // Use app.commands.removeCommand if available (check Obsidian API version if needed)
        if (this.app.commands.removeCommand) {
            this.app.commands.removeCommand(fullCommandId);
            // console.log(`Unregistered command: ${fullCommandId}`);
        } else {
            // Fallback or log if removeCommand is not available in target minAppVersion
            console.warn(`Command ${fullCommandId} removed from settings, but removeCommand API is not available.`);
        }
      }
    });
    this.registeredCommandIds.clear(); // Clear the old set

    // Register each custom command from current settings
    this.settings.commands.forEach(command => {
      const fullCommandId = `${this.manifest.id}:custom-cmd-${command.id}`;
      this.addCommand({
        id: `custom-cmd-${command.id}`, // ID used within the plugin manifest context
        name: command.name,
        callback: () => {
          switch (command.type) {
            case 'open':
              const resolvedOpenPath = this.resolveDatePlaceholders(command.path);
              this.openNote(resolvedOpenPath);
              break;
            case 'create':
              const resolvedCreatePath = this.resolveDatePlaceholders(command.path);
              const resolvedTemplatePath = this.resolveDatePlaceholders(command.templatePath); // Also resolve template path
              this.createNote(resolvedCreatePath, resolvedTemplatePath);
              break;
            case 'insert':
              const resolvedSnippet = this.resolveDatePlaceholders(command.snippet);
              this.insertSnippet(resolvedSnippet);
              break;
            case 'sequence':
              // Pass the commandIds string (which now contains names)
              this.runCommandSequence(command.commandIds);
              break;
            default:
              console.warn(`Unknown command type: ${command.type}`);
          }
        }
      });
      // Add the full command ID (including plugin prefix) to the set of currently registered commands
      this.registeredCommandIds.add(fullCommandId);
      newRegisteredIds.add(fullCommandId); // Track newly registered/updated IDs
    });

     // Update the tracked set
     this.registeredCommandIds = newRegisteredIds;
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
          // Use Obsidian's sleep function if available, otherwise basic setTimeout
          const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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


  // --- Existing Methods (resolveDatePlaceholders, formatDate, etc.) ---
  // Resolve date placeholders in the path
  resolveDatePlaceholders(path) {
    if (!path) return path;

    // Get current date
    const now = new Date();

    // Replace date placeholders
    // Format: {{date}} or {{date:FORMAT}} or {{date+N}} or {{date-N}}
    let resolvedPath = path.replace(/\{\{date(\+|-)?(\d+)?(:([^}]+))?\}\}/g, (match, op, offsetStr, _, format) => {
      // Calculate date with offset if provided
      let date = new Date(now);
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

    // Replace other placeholders
    resolvedPath = resolvedPath
        .replace(/\{\{year\}\}/g, now.getFullYear().toString())
        .replace(/\{\{month\}\}/g, String(now.getMonth() + 1).padStart(2, '0'))
        .replace(/\{\{day\}\}/g, String(now.getDate()).padStart(2, '0'))
        .replace(/\{\{weekday\}\}/g, this.getWeekdayName(now.getDay()))
        .replace(/\{\{monthName\}\}/g, this.getMonthName(now.getMonth()));

    // --- Add Time Placeholders ---
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

      // Use getFirstLinkpathDest to resolve the path to a TFile
      // The second argument is the source path (current file), empty string means resolve from vault root
      const file = this.app.metadataCache.getFirstLinkpathDest(notePath, '');

      if (file instanceof TFile) {
        // Open the file in the configured leaf/tab/window
        await this.app.workspace.getLeaf(this.settings.leaf).openFile(file);
      } else {
        // Handle case where the path doesn't resolve to a file
        // Check if it might be a folder path or just doesn't exist
        const abstractItem = this.app.vault.getAbstractFileByPath(normalizePath(notePath));
        if (abstractItem) {
             new Notice(`Path "${notePath}" points to a folder, not a file.`);
        } else {
             new Notice(`Note "${notePath}" not found.`);
        }
        console.log(`Failed to find or open file using getFirstLinkpathDest: ${notePath}`);
      }
    } catch (error) {
      console.error('Error opening note:', error);
      new Notice(`Error opening note: ${error.message}`);
    }
  }

  onunload() {
    // console.log('Unloading Custom Commands Plugin');
    // Consider if commands need explicit cleanup on unload, though Obsidian usually handles this.
    // If using removeCommand, ensure it's called appropriately if needed during unload,
    // but typically commands are removed when the plugin is disabled/unloaded automatically.
  }
}