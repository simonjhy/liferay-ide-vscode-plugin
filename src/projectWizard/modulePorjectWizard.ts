/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QuickPickItem, window, QuickInputButton, ExtensionContext, Uri, ProgressLocation, workspace } from 'vscode';
import { ProjectStepInput } from './baseProjectWizard';
import { spawnSync } from 'child_process';
import { findJavaHomes, JavaRuntime } from '../java-runtime/findJavaHomes';
import Constants from '../constants';
import { downloadFile, findDirectoriesContaining, findMatchingWorkspaceFolder, getCurrentWorkspacePath, getJavaExecutable, refreshWorkspaceView } from '../liferayUtils';
import * as vscode from 'vscode';
import path = require('path');

export async function createLiferayModuleProject(context: ExtensionContext) {

	class MyButton implements QuickInputButton {
		constructor(public iconPath: { light: Uri; dark: Uri; }, public tooltip: string) { }
	}

	const createResourceGroupButton = new MyButton({
		dark: Uri.file(context.asAbsolutePath('resources/dark/add.svg')),
		light: Uri.file(context.asAbsolutePath('resources/light/add.svg')),
	}, 'Create Resource Group');

	async function inputResourceGroupName(input: ProjectStepInput, state: Partial<State>) {
		state.moduleType = await input.showInputBox({
			title,
			step: 2,
			totalSteps: 4,
			value: typeof state.moduleType === 'string' ? state.moduleType : '',
			prompt: 'Choose a unique name for the resource groupqqqqqqqqqqqqqqqqqq',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => setLifreayModulePackageName(input, state);
	}

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		moduleType: QuickPickItem | string;
		name: string;
		packageName: string;
	}

	async function createLiferayModule() {
		const state = {} as Partial<State>;
		await ProjectStepInput.run(input => setLifreayModuleProjectName(input, state));
		return state as State;
	}

	const title = 'Create Liferay Moudule Project';

	async function setLiferayModuleType(input: ProjectStepInput, state: Partial<State>) {
		const loadingItems: QuickPickItem[] = [{ label: 'Loading.....', description: 'Wait to load liferay module types' }];
		const pick = await input.showQuickPick({
			title,
			step: 2,
			totalSteps: 3,
			placeholder: 'Choose a liferay module type:',
			items: loadingItems,
			activeItem: typeof state.moduleType !== 'string' ? state.moduleType : undefined,
			buttons: [],
			shouldResume: shouldResume,
			initQuickItems: getAvailableModuleTypes
		});
		console.log("Choose is [" + state.name + "]");
		if (pick instanceof MyButton) {
			return (input: ProjectStepInput) => inputResourceGroupName(input, state);
		}
		state.moduleType = pick;
		return (input: ProjectStepInput) => setLifreayModulePackageName(input, state);
	}

	async function getAvailableModuleTypes(): Promise<QuickPickItem[]> {
		const bladeJarPath = await downloadFile(Constants.BLADE_DOWNLOAD_URL, Constants.BLADE_CACHE_DIR,"blade.jar");

		let moduleTypes: string[] = [];

		let javahome : JavaRuntime[] = await findJavaHomes();
		const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'create', '-l'], { encoding: 'utf-8' });

		if (result.status !== 0) {
			console.error(result.stderr);
		}

		moduleTypes =  result.stdout.split('\n');

		return moduleTypes.map(label => ({ label }));
	}

	async function setLifreayModuleProjectName(input: ProjectStepInput, state: Partial<State>) {
		state.name = await input.showInputBox({
			title,
			step: 1,
			totalSteps: 3,
			value: state.name || '',
			prompt: 'Choose a unique name for liferay module project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		return (input: ProjectStepInput) => setLiferayModuleType(input, state);
	}


	async function setLifreayModulePackageName(input: ProjectStepInput, state: Partial<State>) {
		state.packageName = await input.showInputBox({
			title,
			step: 3,
			totalSteps: 3,
			value: state.packageName || '',
			prompt: 'Choose a package name for liferay module project',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
	}

	function shouldResume() {
		// Could show a notification with the option to resume.
		return new Promise<boolean>((_resolve, _reject) => {

		});
	}

	async function validateNameIsUnique(name: string) {
		const result = findMatchingWorkspaceFolder(name);
		if (result && result.match) {
			return 'Name not unique';
		}
		return undefined;
	}

	async function bladeCreateModuleProject(): Promise<void> {
		const bladeJarPath = await downloadFile(Constants.BLADE_DOWNLOAD_URL, Constants.BLADE_CACHE_DIR, Constants.BALDE_JAR_NAME);
		let javahome : JavaRuntime[] = await findJavaHomes();

		let moduleType = state.moduleType as QuickPickItem;

		let moduleTypeString = moduleType.label;

		const index = moduleTypeString.indexOf(" ");

		const type = moduleTypeString.substring(0, index);

		console.log("module type is " + type);

		let currentLiferayWorkspacePorjectPath = getCurrentWorkspacePath();

		if (!currentLiferayWorkspacePorjectPath || currentLiferayWorkspacePorjectPath === undefined){
			throw new Error(`Failed to create Liferay Module Project.`);
		}

		const result  = spawnSync(getJavaExecutable(javahome[0]), ['-jar', bladeJarPath, 'create', '-t', type, '--base', currentLiferayWorkspacePorjectPath, '-p', state.packageName, state.name], { encoding: 'utf-8' });

		if (result.status !== 0) {
			throw new Error(`Failed to create a ${type} liferay worksapce project for ${state.name}`);
		}

		refreshWorkspaceView();
	}

	const state = await createLiferayModule();

	bladeCreateModuleProject();

	window.showInformationMessage(`Creating Application Service '${state.name}'`);
}
