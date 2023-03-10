// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Commands } from './commands';
import { window, commands, ExtensionContext } from 'vscode';
import { showQuickPick, showInputBox } from './basicInput';
import { gradleWorkspaceStepInput as Gradle } from './gradleProjectInput';
import { quickOpen } from './quickOpen';
import { findJavaRuntimeEntries } from './java-runtime';
import { findJavaHomes, JavaRuntime } from './java-runtime/findJavaHomes';
import { spawn, execFile, execSync } from 'child_process';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "liferay-ide-vscode-plugin" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json	
	context.subscriptions.push(vscode.commands.registerCommand(Commands.NEW_LIFERAY_WORKSAPCE, async () => {
		const options: { [key: string]: (context: ExtensionContext) => Promise<void> } = {
			//showQuickPick,
			//showInputBox,
			Gradle
			//quickOpen,
		};
		const quickPick = window.createQuickPick();
		quickPick.items = Object.keys(options).map(label => ({ label }));
		quickPick.onDidChangeSelection(selection => {
			if (selection[0]) {
				options[selection[0].label](context)
					.catch(console.error);
			}
		});
		quickPick.onDidHide(() => quickPick.dispose());
		quickPick.show();
	}));

	context.subscriptions.push(vscode.commands.registerCommand(Commands.NEW_LIFERAY_MODULE, async () => {
		const options: vscode.QuickPickItem[] = [
			{ label: '选项 1', description: '这是选项 1 的描述' },
			{ label: '选项 2', description: '这是选项 2 的描述' },
			{ label: '选项 3', description: '这是选项 3 的描述' },
			{ label: '选项 4', description: '这是选项 4 的描述' },
			{ label: '选项 5', description: '这是选项 5 的描述' },
		];
	
		const quickPick = window.createQuickPick();
		quickPick.canSelectMany = false; // 开启 Multiple Selections
		quickPick.items = options;
	
	
		// 处理 Quick Pick 的选择结果
		quickPick.onDidAccept(() => {
			const selectedItems = quickPick.selectedItems;
			quickPick.dispose(); // 关闭 Quick Pick
			console.log('选中项：', selectedItems); // 执行命令
		});
	
		// 显示 Quick Pick
		quickPick.show();
	}));

	findJavaHomes().then((runtimes: JavaRuntime[]) => {
		runtimes.forEach(runtime => 
			console.log(runtime.home + ' ' +runtime.version));
	  })
	  .catch((error: any) => {
		console.error(error);
	  });
	
	const bladeJarPath = context.asAbsolutePath('resources/dependencies/blade.jar');

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


