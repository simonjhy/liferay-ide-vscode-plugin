/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem, window, QuickInputButton, ExtensionContext, Uri, ProgressLocation, workspace } from 'vscode';
import { ProjectStepInput } from './projectQuickInput';
import { spawnSync } from 'child_process';
import fetch from 'node-fetch';
import { Comparator } from 'lodash';


/**
 * A multi-step input using window.createQuickPick() and window.createInputBox().
 * 
 * This first part uses the helper class `MultiStepInput` that wraps the API for the multi-step case.
 */
export async function gradleWorkspaceStepInput(context: ExtensionContext) {

	class MyButton implements QuickInputButton {
		constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
	}

	const createResourceGroupButton = new MyButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, 'Create Resource Group');

	const resourceGroups: QuickPickItem[] = ['vscode-data-function', 'vscode-appservice-microservices', 'vscode-appservice-monitor', 'vscode-appservice-preview', 'vscode-appservice-prod']
		.map(label => ({ label }));


	interface State {
		title: string;
		step: number;
		totalSteps: number;
		resourceGroup: QuickPickItem | string;
		name: string;
		runtime: QuickPickItem;
	}

	async function collectInputs() {
		const state = {} as Partial<State>;
		await ProjectStepInput.run(input => inputName(input, state));
		return state as State;
	}

	const title = 'Create Liferay Gradle Workspace Project';

	async function pickResourceGroup(input: ProjectStepInput, state: Partial<State>) {
		// const productVersions = await getAvailableProductVersions();
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load workspace product versions' }];
		const pick = await input.showQuickPick({
			title,
			step: 1,
			totalSteps: 3,
			placeholder: 'Choose a prodcut version:',
			items: loadingItems,
			activeItem: typeof state.resourceGroup !== 'string' ? state.resourceGroup : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableProductVersions
		});
		console.log("Choose is [" + state.name + "]");
		if (pick instanceof MyButton) {
			return (input: ProjectStepInput) => inputResourceGroupName(input, state);
		}
		state.resourceGroup = pick;
		return (input: ProjectStepInput) => pickRuntime(input, state);
	}


	async function getAvailableProductVersions(): Promise<QuickPickItem[]> {
		const bladeJarPath = context.asAbsolutePath('resources/dependencies/blade.jar');

		let productVersions: string[] = [];

		// execFile('C:\\java\\zulu\\11\\bin\\java', ['-jar', bladeJarPath, 'init', '--list'], (_error, _stdout) =>{
		// 	//console.log("Call java process output ["  + _stdout + "]");
		// 	productVersions =  _stdout.split('\n');
		// 	console.log("Call java process output ["  + productVersions + "]");
		// 	return productVersions.map(label => ({ label }));
		// 	//return outputArray.map(label => ({ label }));
		// });

		const result  = spawnSync('C:\\java\\zulu\\11\\bin\\java.exe', ['-jar', bladeJarPath, 'init', '--list'], { encoding: 'utf-8' });

		// if (result.status === 0) {
		// 	//console.log(result.stdout);
		//   } else {
		// 	///console.error(result.stderr);
		//   }

		// console.log("Call subprocess output "  + result.stdout.split('\n'));


		//let productInfos = await getAvailableProductVersionsFromLiferay();

		//console.log("ProductInof is :" + productInfos);

		productVersions =  result.stdout.split('\n');

		return productVersions.map(label => ({ label }));
	}

	async function getAvailableModuleTypes(): Promise<QuickPickItem[]> {
		const bladeJarPath = context.asAbsolutePath('resources/dependencies/blade.jar');

		let productVersions: string[] = [];

		// execFile('C:\\java\\zulu\\11\\bin\\java', ['-jar', bladeJarPath, 'init', '--list'], (_error, _stdout) =>{
		// 	//console.log("Call java process output ["  + _stdout + "]");
		// 	productVersions =  _stdout.split('\n');
		// 	console.log("Call java process output ["  + productVersions + "]");
		// 	return productVersions.map(label => ({ label }));
		// 	//return outputArray.map(label => ({ label }));
		// });

		const result  = spawnSync('C:\\java\\zulu\\11\\bin\\java.exe', ['-jar', bladeJarPath, 'create', '-l'], { encoding: 'utf-8' });

		// if (result.status === 0) {
		// 	//console.log(result.stdout);
		//   } else {
		// 	///console.error(result.stderr);
		//   }

		// console.log("Call subprocess output "  + result.stdout.split('\n'));

		productVersions =  result.stdout.split('\n');

		return productVersions.map(label => ({ label }));
	}

	//   async function getData(url: string):  Promise<Map<string, ProductInfo>> {
	// 	try {
	// 		const response = await fetch(url);
	// 	 	const responseData  = await response.json() as Record<string, ProductInfo>;;
	// 		const myMap = new Map(Object.entries(responseData));
	// 		return myMap as Map<string, ProductInfo> ;
	// 	} catch (err) {
	// 	  throw err;
	// 	}

	//   }

	//   async function getAvailableProductVersionsFromLiferay(): Promise<Map<string, ProductInfo>>{
	// 	const url = 'https://releases.liferay.com/tools/workspace/.product_info.json';
	// 	try {
	// 	  let productInfos =  await getData(url);
	// 	  productInfos.forEach(obj => {
	// 		console.log(obj.targetPlatformVersion);
	// 	  });

	// 	  return productInfos;
	// 	} catch (err) {
	// 		throw err;
	// 	}
	//   }

	async function inputResourceGroupName(input: ProjectStepInput, state: Partial<State>) {
		state.resourceGroup = await input.showInputBox({
			title,
			step: 2,
			totalSteps: 4,
			value: typeof state.resourceGroup === 'string' ? state.resourceGroup : '',
			prompt: 'Choose a unique name for the resource group',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => inputName(input, state);
	}

	async function inputName(input: ProjectStepInput, state: Partial<State>) {
		const additionalSteps = typeof state.resourceGroup === 'string' ? 1 : 0;
		// TODO: Remember current value when navigating back.
		state.name = await input.showInputBox({
			title,
			step: 2 + additionalSteps,
			totalSteps: 3 + additionalSteps,
			value: state.name || '',
			prompt: 'Choose a unique name for liferay gradle workspace project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => pickResourceGroup(input, state);
	}

	async function pickRuntime(input: ProjectStepInput, state: Partial<State>) {
		const additionalSteps = typeof state.resourceGroup === 'string' ? 1 : 0;
		// const runtimes = await getAvailableRuntimes();
		const runtimes: QuickPickItem[]= [];
		// TODO: Remember currently active item when navigating back.
		state.runtime = await input.showQuickPick({
			title,
			step: 3 + additionalSteps,
			totalSteps: 3 + additionalSteps,
			placeholder: 'Choose a Liferay module type:',
			items: runtimes,
			activeItem: state.runtime,
			shouldResume: shouldResume,
			initQuickItems: getAvailableModuleTypes
		});

		console.log("when show moudle type, the product version choose is [" + state.name + "]");
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((_resolve, _reject) => {

		});
	}

	async function validateNameIsUnique(name: string) {
		// ...validate...
		await new Promise(resolve => setTimeout(resolve, 1000));
		return name === 'vscode' ? 'Name not unique' : undefined;
	}

	//async function getAvailableRuntimes(_resourceGroup: QuickPickItem | string, _token?: CancellationToken): Promise<QuickPickItem[]> 
	async function getAvailableRuntimes(): Promise<QuickPickItem[]> {
		// ...retrieve...
		await new Promise(resolve => setTimeout(resolve, 1000));
		return ['Node 8.9', 'Node 6.11', 'Node 4.5']
			.map(label => ({ label }));
	}



	const state = await collectInputs();
	window.showInformationMessage(`Creating Application Service '${state.name}'`);
	
	const version =state.resourceGroup as QuickPickItem;
	const moduleType = state.runtime as QuickPickItem;

	console.log("product version is " + version.label);
	console.log("runtime version is " + moduleType.label);

}


// -------------------------------------------------------
// Helper code that wraps the API for the multi-step case.
// -------------------------------------------------------
