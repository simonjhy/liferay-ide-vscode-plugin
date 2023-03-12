/* eslint-disable @typescript-eslint/naming-convention */
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Commands from './constants';
import { window, ExtensionContext } from 'vscode';
import { initLiferayWorkpsceProject as Gradle } from './projectWizard/workspaceProjectWizard';
import { initLiferayWorkpsceProject as Maven } from './projectWizard/workspaceProjectWizard';
import { findJavaHomes, JavaRuntime } from './java-runtime/findJavaHomes';
import { createLiferayModuleProject } from './projectWizard/modulePorjectWizard';

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

	// console.log(bladeJarPath);

	// let productVersions: string[] = [];
	// const jarProcess = spawn('C:\\java\\zulu\\11\\bin\\java', ['-jar', bladeJarPath, "init", "--list"]);
	// console.log("Call java process "  + jarProcess.exitCode);

	// const result = execSync('C:/java/zulu/11/bin/java -jar ' + bladeJarPath + ' init --list');

	// execFile('C:\\java\\zulu\\11\\bin\\java', ['-jar', bladeJarPath, 'init', '--list'], (_error, _stdout) =>{
	// 	console.log("Call java process output ["  + _stdout + "]");
	// });
	// console.log("Call java process output ["  + result + "]");

	//context.subscriptions.push(disposable);
}


