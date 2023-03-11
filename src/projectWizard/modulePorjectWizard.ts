/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem, window, QuickInputButton, ExtensionContext, Uri, ProgressLocation, workspace } from 'vscode';
import { ProjectStepInput } from './baseProjectWizard';
import { spawnSync } from 'child_process';
import { findJavaHomes, JavaRuntime } from '../java-runtime/findJavaHomes';
import Constants from '../constants';
import { downloadJarFile } from '../utils';

export async function createLiferayModuleProject(context: ExtensionContext) {

	class MyButton implements QuickInputButton {
		constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
	}

	const createResourceGroupButton = new MyButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, 'Create Resource Group');


	interface State {
		title: string;
		step: number;
		totalSteps: number;
		workspaceProduct: QuickPickItem | string;
		name: string;
		runtime: QuickPickItem;
	}

	async function collectInputs() {
		const state = {} as Partial<State>;
		await ProjectStepInput.run(input => inputName(input, state));
		return state as State;
	}

	const title = 'Create Liferay Gradle Workspace Project';

	async function pickWorkspaceProduct(input: ProjectStepInput, state: Partial<State>) {
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load workspace product versions' }];
		const pick = await input.showQuickPick({
			title,
			step: 1,
			totalSteps: 3,
			placeholder: 'Choose a prodcut version:',
			items: loadingItems,
			activeItem: typeof state.workspaceProduct !== 'string' ? state.workspaceProduct : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableProductVersions
		});
		console.log("Choose is [" + state.name + "]");
		if (pick instanceof MyButton) {
			return (input: ProjectStepInput) => inputResourceGroupName(input, state);
		}
		state.workspaceProduct = pick;
		return (input: ProjectStepInput) => pickRuntime(input, state);
	}


	async function getAvailableProductVersions(): Promise<QuickPickItem[]> {
		const bladeJarPath = await downloadJarFile(Constants.BLADE_DOWNLOAD_URL,"blade.jar");

		let productVersions: string[] = [];

		// execFile('C:\\java\\zulu\\11\\bin\\java', ['-jar', bladeJarPath, 'init', '--list'], (_error, _stdout) =>{
		// 	//console.log("Call java process output ["  + _stdout + "]");
		// 	productVersions =  _stdout.split('\n');
		// 	console.log("Call java process output ["  + productVersions + "]");
		// 	return productVersions.map(label => ({ label }));
		// 	//return outputArray.map(label => ({ label }));
		// });
		let javahome : JavaRuntime[] = await findJavaHomes();

		const result  = spawnSync(javahome[0].home + '/bin/java', ['-jar', bladeJarPath, 'init', '--list'], { encoding: 'utf-8' });

		if (result.status !== 0) {
			console.error(result.stderr);
		  }

		productVersions =  result.stdout.split('\n');

		return productVersions.map(label => ({ label }));
	}

	async function getAvailableModuleTypes(): Promise<QuickPickItem[]> {
		const bladeJarPath = await downloadJarFile(Constants.BLADE_DOWNLOAD_URL,"blade.jar");

		let productVersions: string[] = [];

		let javahome : JavaRuntime[] = await findJavaHomes();
		const result  = spawnSync(javahome[0].home + '/bin/java', ['-jar', bladeJarPath, 'create', '-l'], { encoding: 'utf-8' });

		if (result.status !== 0) {
			console.error(result.stderr);
		}

		productVersions =  result.stdout.split('\n');

		return productVersions.map(label => ({ label }));
	}



	async function inputResourceGroupName(input: ProjectStepInput, state: Partial<State>) {
		state.workspaceProduct = await input.showInputBox({
			title,
			step: 2,
			totalSteps: 4,
			value: typeof state.workspaceProduct === 'string' ? state.workspaceProduct : '',
			prompt: 'Choose a unique name for the resource group',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => inputName(input, state);
	}

	async function inputName(input: ProjectStepInput, state: Partial<State>) {
		const additionalSteps = typeof state.workspaceProduct === 'string' ? 1 : 0;
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
		return (input: ProjectStepInput) => pickWorkspaceProduct(input, state);
	}


	async function pickRuntime(input: ProjectStepInput, state: Partial<State>) {
		const additionalSteps = typeof state.workspaceProduct === 'string' ? 1 : 0;
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
	
	const version =state.workspaceProduct as QuickPickItem;
	const moduleType = state.runtime as QuickPickItem;

	console.log("product version is " + version.label);
	console.log("runtime version is " + moduleType.label);

}
