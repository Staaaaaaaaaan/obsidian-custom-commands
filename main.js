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
    containerEl.empty();

    // Add button to create new command
    new Setting(containerEl)
      .setName('Add new command')
      .setDesc('Create a new custom command')
      .addButton(button => button
        .setButtonText('Add command')
        .setCta()
        .onClick(async () => {
          const newName = 'New command';
          // Generate unique ID for the new command
          const newId = generateUniqueId(newName, this.plugin.settings.commands);
          const newCommand = {
            id: newId,
            type: 'open',
            name: newName,
            path: '',
            templatePath: '',
            snippet: '',
            commandIds: ''
          };
          this.plugin.settings.commands.push(newCommand);
          await this.plugin.saveSettings();
          this.display();
        }));

    // Display existing commands
    this.plugin.settings.commands.forEach((command, index) => {
      const commandSetting = new Setting(containerEl)
        .setClass('command-setting');

      // --- Command Type Dropdown ---
      commandSetting.addDropdown(dropdown => dropdown
        .addOption('open', 'Open')
        .addOption('create', 'Create')
        .addOption('insert', 'Insert')
        .addOption('sequence', 'Sequence')
        .setValue(command.type || 'open')
        .onChange(async (value) => {
          this.plugin.settings.commands[index].type = value;
          if (value !== 'open' && value !== 'create') this.plugin.settings.commands[index].path = '';
          if (value !== 'create') this.plugin.settings.commands[index].templatePath = '';
          if (value !== 'insert') this.plugin.settings.commands[index].snippet = '';
          if (value !== 'sequence') this.plugin.settings.commands[index].commandIds = '';
          await this.plugin.saveSettings();
          this.plugin.registerCommands();
          this.display();
        }));

      // --- Command name input with unique ID update ---
      commandSetting.addText(text => text
        .setPlaceholder('Command name')
        .setValue(command.name)
        .onChange(async (value) => {
          this.plugin.settings.commands[index].name = value;
          // Generate a unique ID for the new name, skipping this command's own index
          this.plugin.settings.commands[index].id = generateUniqueId(value, this.plugin.settings.commands, index);
          await this.plugin.saveSettings();
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
        
        commandSetting.addText(text => text
        .setPlaceholder('Template path (Optional)')
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
          .setPlaceholder('Command names (comma-sep)')
          .setValue(command.commandIds || '') // Keep using commandIds field internally
          .onChange(async (value) => {
            this.plugin.settings.commands[index].commandIds = value; // Store the names string
            await this.plugin.saveSettings();
          })
          .inputEl.addClass('custom-command-input-full-width'));
          break;
      }

      // // Add CSS to the document for full-width inputs
      // document.head.querySelector('style.custom-commands-styles') || 
      // document.head.appendChild(createEl('style', {
      //   attr: { 'class': 'custom-commands-styles' },
      //   text: `
      //     .custom-command-input-full-width {
      //   flex-grow: 1 !important;
      //   margin-right: 8px;
      //     }
      //     .command-setting .setting-item-control {
      //   display: flex;
      //   flex-wrap: nowrap;
      //   flex-grow: 1;
      //   justify-content: flex-end;
      //     }
      //   `
      // }));

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
      .setName('New note option')
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
          // No need to call this.display() here, the setting is saved.
          // Reloading the settings tab will show the correct value.
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
        "name": "Open home",
        "path": normalizePath("00/Home.md"),
        "type": "open"
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
      
      // Only add .md if no extension exists
      const hasExtension = /\.[^.]+$/.test(notePath);
      if (!hasExtension) {
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

// --- Utility: Generate a unique ID based on name ---
function generateUniqueId(baseName, commands, skipIndex = -1) {
  let baseId = baseName.toLowerCase().replace(/\s+/g, '-');
  let id = baseId;
  let counter = 2;
  // Check for duplicates (skipIndex is used to skip the current command when renaming)
  while (commands.some((cmd, idx) => idx !== skipIndex && cmd.id === id)) {
    id = `${baseId}-${counter++}`;
  }
  return id;
}

// Helper function for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
