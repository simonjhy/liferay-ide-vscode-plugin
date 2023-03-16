/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Commands from './constants';
import { window, ExtensionContext } from 'vscode';
import { initLiferayWorkpsceProject as Gradle } from './projectWizard/workspaceProjectWizard';
import { initLiferayWorkpsceProject as Maven } from './projectWizard/workspaceProjectWizard';
import { createLiferayModuleProject } from './projectWizard/modulePorjectWizard';
import { createLiferayClientExtensionProject } from './projectWizard/clientExtensionPorjectWizard';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "liferay-ide-vscode-plugin" is now active!');

	context.subscriptions.push(vscode.commands.registerCommand(Commands.NEW_LIFERAY_WORKSAPCE, async () => {
		
		const quickPick = window.createQuickPick();

		const options: { [key: string]: (context: ExtensionContext, worksapceType: string) => Promise<void> } = {
			Gradle,
			Maven
		};

		quickPick.items = Object.keys(options).map(label => ({ label }));
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
				options[selection[0].label](context, selection[0].label)
					.catch(console.error);
				
			}
		});

		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}));

	context.subscriptions.push(vscode.commands.registerCommand(Commands.NEW_LIFERAY_MODULE, async () => {
		createLiferayModuleProject(context);
	}));

	context.subscriptions.push(vscode.commands.registerCommand(Commands.NEW_LIFERAY_CLIENT_EXTENSION, async () => {
		createLiferayClientExtensionProject(context);
	}));
}


